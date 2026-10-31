import { useMemo, useState } from 'react';
import { ListChecks, Plus, Search, Trash2 } from 'lucide-react';
import { useExcluirLancamento, useLancamentos } from '../hooks/queries';
import { dateBR, money, num } from '../lib/format';
import { symbol } from '../lib/ticker';
import { useToast } from '../providers/ToastProvider';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  IconButton,
  Input,
  Kpi,
  PageHeader,
  Segmented,
  Skeleton,
  cx,
} from '../components/ui';
import { TickerCell } from '../components/TickerCell';
import { UpdatedAt } from '../components/UpdatedAt';
import { useShell } from '../components/layout/shell-context';

const FILTROS = [
  { value: 'todos', label: 'Todos' },
  { value: 'C', label: 'Compras' },
  { value: 'V', label: 'Vendas' },
];

/** Compra: desembolso = qtd × preço + custos · Venda: recebido = qtd × preço − custos */
const totalOperacao = (l) => l.quantidade * l.preco + (l.tipo === 'C' ? l.taxas : -l.taxas);

function resumir(lancamentos) {
  const r = { compras: 0, nCompras: 0, vendas: 0, nVendas: 0, custos: 0 };
  for (const l of lancamentos) {
    const bruto = l.quantidade * l.preco;
    if (l.tipo === 'C') {
      r.compras += bruto;
      r.nCompras += 1;
    } else {
      r.vendas += bruto;
      r.nVendas += 1;
    }
    r.custos += l.taxas || 0;
  }
  return r;
}

const ops = (n) => `${n} ${n === 1 ? 'operação' : 'operações'}`;

export function LancamentosPage() {
  const { openLancamento } = useShell();
  const toast = useToast();
  const lancamentos = useLancamentos();
  const excluir = useExcluirLancamento();

  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [confirmar, setConfirmar] = useState(null);

  const lista = lancamentos.data;
  const resumo = useMemo(() => (lista ? resumir(lista) : null), [lista]);
  const filtrados = useMemo(() => {
    if (!lista) return [];
    const q = busca.trim().toUpperCase();
    return lista.filter((l) => (filtro === 'todos' || l.tipo === filtro) && (!q || l.ticker.includes(q)));
  }, [lista, busca, filtro]);

  const confirmarExclusao = async () => {
    try {
      await excluir.mutateAsync(confirmar.id);
      toast.success('Lançamento excluído.');
      setConfirmar(null);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const loading = lancamentos.isPending;

  return (
    <>
      <PageHeader
        title="Lançamentos"
        subtitle={
          <span className="flex items-center gap-2">
            Confira todas as operações registradas
            <UpdatedAt query={lancamentos} />
          </span>
        }
        actions={
          <Button icon={Plus} onClick={() => openLancamento()}>
            Adicionar lançamento
          </Button>
        }
      />

      {lancamentos.isError && !lista ? (
        <Card>
          <ErrorState error={lancamentos.error} onRetry={() => lancamentos.refetch()} />
        </Card>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-4">
            <Kpi loading={loading} label="Total em compras" value={money(resumo?.compras)} hint={ops(resumo?.nCompras ?? 0)} />
            <Kpi loading={loading} label="Total em vendas" value={money(resumo?.vendas)} hint={ops(resumo?.nVendas ?? 0)} />
            <Kpi loading={loading} label="Custos pagos" value={money(resumo?.custos)} hint="Corretagem e taxas" />
          </div>

          <Card className="overflow-hidden">
            <div className="flex items-center gap-3 border-b border-slate-100 p-4">
              <Input
                icon={Search}
                placeholder="Filtrar por ação"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-64"
                aria-label="Filtrar por ação"
              />
              <Segmented options={FILTROS} value={filtro} onChange={setFiltro} />
            </div>

            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                  <th className="px-5 py-3 text-left">Data</th>
                  <th className="px-5 py-3 text-left">Ação</th>
                  <th className="px-5 py-3 text-left">Tipo</th>
                  <th className="px-5 py-3 text-right">Qtd</th>
                  <th className="px-5 py-3 text-right">Preço</th>
                  <th className="px-5 py-3 text-right">Custos</th>
                  <th className="px-5 py-3 text-right">Total</th>
                  <th className="w-14 px-3 py-3">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading &&
                  Array.from({ length: 5 }, (_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 8 }, (_, j) => (
                        <td key={j} className="px-5 py-4">
                          {j < 7 && <Skeleton className={cx('h-4', j < 3 ? 'w-20' : 'ml-auto w-16')} />}
                        </td>
                      ))}
                    </tr>
                  ))}
                {filtrados.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3.5 text-slate-500 tabular-nums">{dateBR(l.data)}</td>
                    <td className="px-5 py-3.5">
                      <TickerCell ticker={l.ticker} />
                    </td>
                    <td className="px-5 py-3.5">
                      {l.tipo === 'C' ? <Badge tone="green">Compra</Badge> : <Badge tone="red">Venda</Badge>}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums">{num(l.quantidade)}</td>
                    <td className="px-5 py-3.5 text-right tabular-nums">{money(l.preco)}</td>
                    <td className="px-5 py-3.5 text-right text-slate-500 tabular-nums">{money(l.taxas)}</td>
                    <td className="px-5 py-3.5 text-right font-medium tabular-nums">{money(totalOperacao(l))}</td>
                    <td className="px-3 py-3.5 text-center">
                      <IconButton
                        label="Excluir lançamento"
                        icon={Trash2}
                        onClick={() => setConfirmar(l)}
                        className="hover:bg-rose-50 hover:text-rose-600"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!loading && filtrados.length === 0 && (
              <EmptyState icon={ListChecks} title={lista?.length ? 'Nenhum lançamento encontrado' : 'Nenhum lançamento ainda'}>
                {lista?.length ? 'Ajuste a busca ou o filtro.' : 'Registre uma compra para começar.'}
              </EmptyState>
            )}
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={confirmar !== null}
        title="Excluir lançamento?"
        loading={excluir.isPending}
        onCancel={() => setConfirmar(null)}
        onConfirm={confirmarExclusao}
        message={
          confirmar && (
            <>
              A {confirmar.tipo === 'C' ? 'compra' : 'venda'} de <strong>{num(confirmar.quantidade)}</strong>{' '}
              <strong>{symbol(confirmar.ticker)}</strong> em {dateBR(confirmar.data)} ({money(totalOperacao(confirmar))}) será
              removida e a carteira recalculada. Esta ação não pode ser desfeita.
            </>
          )
        }
      />
    </>
  );
}
