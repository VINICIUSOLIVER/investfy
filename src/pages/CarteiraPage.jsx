import { useMemo, useState } from 'react';
import { ChartLine, Plus, Wallet } from 'lucide-react';
import { useCarteira, useEvolucao } from '../hooks/queries';
import { money, num, pct, signedMoney, toneClass } from '../lib/format';
import { symbol } from '../lib/ticker';
import { Button, Card, ChangeBadge, EmptyState, ErrorState, Kpi, PageHeader, Segmented, Skeleton, cx } from '../components/ui';
import { UpdatedAt } from '../components/UpdatedAt';
import { TickerCell } from '../components/TickerCell';
import { EvolutionChart } from '../components/charts/EvolutionChart';
import { DonutChart } from '../components/charts/DonutChart';
import { MAX_SLICES, OTHER_COLOR, SERIES_COLORS } from '../components/charts/shared';
import { useShell } from '../components/layout/shell-context';

const PERIODOS = [
  { value: 30, label: '30d' },
  { value: 90, label: '90d' },
  { value: 180, label: '6m' },
  { value: 365, label: '1a' },
];

/** Agregados da carteira (somente somas; PM e rentabilidade vêm prontos da API). */
function resumir(posicoes) {
  const ativas = posicoes.filter((p) => p.quantidade > 0);
  const encerradas = posicoes.filter((p) => p.quantidade === 0);
  const cotadas = ativas.filter((p) => p.valorAtual != null);

  const patrimonio = cotadas.reduce((s, p) => s + p.valorAtual, 0);
  const investido = ativas.reduce((s, p) => s + p.totalInvestido, 0);
  const investidoCotado = cotadas.reduce((s, p) => s + p.totalInvestido, 0);
  const resultado = patrimonio - investidoCotado;
  const realizado = posicoes.reduce((s, p) => s + (p.lucroRealizado || 0), 0);

  // Variação do dia em R$: valorAtual − valorAtual / (1 + variacaoDia)
  let variacaoHoje = 0;
  let baseOntem = 0;
  for (const p of cotadas) {
    if (p.variacaoDia == null) continue;
    const ontem = p.valorAtual / (1 + p.variacaoDia);
    variacaoHoje += p.valorAtual - ontem;
    baseOntem += ontem;
  }

  return {
    ativas,
    encerradas,
    pendentes: ativas.length - cotadas.length,
    patrimonio,
    investido,
    resultado,
    resultadoPct: investidoCotado ? resultado / investidoCotado : null,
    realizado,
    variacaoHoje,
    variacaoHojePct: baseOntem ? variacaoHoje / baseOntem : null,
  };
}

/** Cor fixa por ticker (ordem alfabética da API), independente do ranking. */
function alocacao(ativas) {
  const colorOf = new Map(ativas.map((p, i) => [p.ticker, SERIES_COLORS[i % SERIES_COLORS.length]]));
  const ranked = ativas
    .filter((p) => p.valorAtual > 0)
    .sort((a, b) => b.valorAtual - a.valorAtual)
    .map((p) => ({ key: p.ticker, label: symbol(p.ticker), value: p.valorAtual, color: colorOf.get(p.ticker) }));
  if (ativas.length <= MAX_SLICES) return ranked;
  const top = ranked.slice(0, MAX_SLICES - 1);
  const resto = ranked.slice(MAX_SLICES - 1).reduce((s, x) => s + x.value, 0);
  return [...top, { key: '__outros', label: 'Outros', value: resto, color: OTHER_COLOR }];
}

export function CarteiraPage() {
  const { openLancamento, openSearch } = useShell();
  const carteira = useCarteira();
  const resumo = useMemo(() => (carteira.data ? resumir(carteira.data) : null), [carteira.data]);
  const loading = carteira.isPending;

  return (
    <>
      <PageHeader
        title="Carteira"
        subtitle={
          <span className="flex items-center gap-2">
            Resumo das suas ações
            <UpdatedAt query={carteira} />
          </span>
        }
        actions={
          <Button icon={Plus} onClick={() => openLancamento()}>
            Adicionar lançamento
          </Button>
        }
      />

      {carteira.isError && !carteira.data ? (
        <Card>
          <ErrorState error={carteira.error} onRetry={() => carteira.refetch()} />
        </Card>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-4 gap-4">
            <Kpi
              loading={loading}
              label="Patrimônio"
              value={money(resumo?.patrimonio)}
              hint={
                resumo?.pendentes
                  ? `${resumo.ativas.length} ativos · ${resumo.pendentes} sem cotação`
                  : `${resumo?.ativas.length ?? 0} ${resumo?.ativas.length === 1 ? 'ativo' : 'ativos'}`
              }
            />
            <Kpi loading={loading} label="Valor investido" value={money(resumo?.investido)} hint="Custo médio total" />
            <Kpi
              loading={loading}
              label="Resultado"
              value={signedMoney(resumo?.resultado)}
              hint={`${pct(resumo?.resultadoPct)} · Realizado ${signedMoney(resumo?.realizado)}`}
              hintClass={toneClass(resumo?.resultado)}
            />
            <Kpi
              loading={loading}
              label="Variação hoje"
              value={signedMoney(resumo?.variacaoHoje)}
              hint={pct(resumo?.variacaoHojePct)}
              hintClass={toneClass(resumo?.variacaoHoje)}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <EvolucaoCard />
            <Card className="p-5">
              <h2 className="mb-4 text-sm font-medium text-slate-700">Alocação</h2>
              {loading ? (
                <div className="flex flex-col items-center gap-4">
                  <Skeleton className="size-44 rounded-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ) : resumo.patrimonio > 0 ? (
                <DonutChart slices={alocacao(resumo.ativas)} />
              ) : (
                <EmptyState icon={Wallet} title="Sem posições abertas" />
              )}
            </Card>
          </div>

          <PosicoesTable loading={loading} resumo={resumo} onSelect={openSearch} onAdd={() => openLancamento()} />
          {resumo?.encerradas.length > 0 && <EncerradasTable posicoes={resumo.encerradas} onSelect={openSearch} />}
        </div>
      )}
    </>
  );
}

function EvolucaoCard() {
  const [dias, setDias] = useState(90);
  const evolucao = useEvolucao(dias);
  const data = evolucao.data ?? [];

  return (
    <Card className="col-span-2 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-700">Evolução do patrimônio</h2>
        <Segmented size="sm" options={PERIODOS} value={dias} onChange={setDias} />
      </div>
      {evolucao.isPending ? (
        <Skeleton className="h-[284px] w-full" />
      ) : evolucao.isError ? (
        <ErrorState error={evolucao.error} onRetry={() => evolucao.refetch()} className="h-[284px] justify-center" />
      ) : data.length < 2 ? (
        <EmptyState icon={ChartLine} title="Coletando dados" className="h-[284px] justify-center">
          Uma foto do patrimônio é tirada a cada dia de pregão (~19h). O gráfico se completa com o tempo.
        </EmptyState>
      ) : (
        <EvolutionChart data={data} />
      )}
    </Card>
  );
}

const TH = 'px-5 py-3 text-xs font-medium tracking-wide text-slate-500 uppercase';

function PosicoesTable({ loading, resumo, onSelect, onAdd }) {
  return (
    <Card className="overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className={cx(TH, 'text-left')}>Ação</th>
            <th className={cx(TH, 'text-right')}>Qtd</th>
            <th className={cx(TH, 'text-right')}>Preço médio</th>
            <th className={cx(TH, 'text-right')}>Atual</th>
            <th className={cx(TH, 'text-right')}>Hoje</th>
            <th className={cx(TH, 'text-right')}>Saldo</th>
            <th className={cx(TH, 'text-right')}>Resultado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loading &&
            Array.from({ length: 4 }, (_, i) => (
              <tr key={i}>
                {Array.from({ length: 7 }, (_, j) => (
                  <td key={j} className="px-5 py-4">
                    <Skeleton className={cx('h-4', j === 0 ? 'w-16' : 'ml-auto w-20')} />
                  </td>
                ))}
              </tr>
            ))}
          {!loading &&
            resumo.ativas.map((p) => (
              <tr
                key={p.ticker}
                onClick={() => onSelect(p.ticker)}
                className="cursor-pointer transition-colors hover:bg-slate-50"
                title="Ver detalhes da ação"
              >
                <td className="px-5 py-3.5">
                  <TickerCell ticker={p.ticker} />
                </td>
                <td className="px-5 py-3.5 text-right tabular-nums">{num(p.quantidade)}</td>
                <td className="px-5 py-3.5 text-right tabular-nums">{money(p.precoMedio)}</td>
                <td className="px-5 py-3.5 text-right tabular-nums">
                  {p.precoAtual == null ? <Skeleton className="ml-auto h-4 w-16" /> : money(p.precoAtual)}
                </td>
                <td className="px-5 py-3.5 text-right">
                  {p.variacaoDia == null ? '—' : <ChangeBadge value={p.variacaoDia}>{pct(p.variacaoDia)}</ChangeBadge>}
                </td>
                <td className="px-5 py-3.5 text-right font-medium tabular-nums">{money(p.valorAtual)}</td>
                <td className={cx('px-5 py-3.5 text-right font-medium tabular-nums', toneClass(p.rentabilidade))}>
                  {signedMoney(p.rentabilidade)}{' '}
                  {p.rentabilidadePct != null && <span className="text-xs font-normal">({pct(p.rentabilidadePct)})</span>}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
      {!loading && resumo.ativas.length === 0 && (
        <EmptyState icon={Wallet} title="Nenhuma ação na carteira">
          <button type="button" onClick={onAdd} className="text-blue-600 hover:underline">
            Registre sua primeira compra
          </button>{' '}
          para acompanhar sua carteira.
        </EmptyState>
      )}
    </Card>
  );
}

function EncerradasTable({ posicoes, onSelect }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-3">
        <h2 className="text-sm font-medium text-slate-700">Posições encerradas</h2>
      </div>
      <table className="w-full text-sm">
        <tbody className="divide-y divide-slate-100">
          {posicoes.map((p) => (
            <tr key={p.ticker} onClick={() => onSelect(p.ticker)} className="cursor-pointer text-slate-600 hover:bg-slate-50">
              <td className="px-5 py-3">
                <TickerCell ticker={p.ticker} muted />
              </td>
              <td className="px-5 py-3 text-right text-xs text-slate-500">Lucro realizado</td>
              <td className={cx('w-48 px-5 py-3 text-right font-medium tabular-nums', toneClass(p.lucroRealizado))}>
                {signedMoney(p.lucroRealizado)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
