import { useMemo, useState } from 'react';
import { Check, Eye, Pencil, Plus, Target, X } from 'lucide-react';
import { useAcompanhamento, useAcompanhar, useAlterarAlvo, useDesacompanhar } from '../hooks/queries';
import { DASH, dayMonth, isNum, money, parseDecimal, pct, todayISO } from '../lib/format';
import { exchange, isValidTicker, normalizeTicker, symbol } from '../lib/ticker';
import { useToast } from '../providers/ToastProvider';
import {
  Badge,
  Button,
  Card,
  ChangeBadge,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  IconButton,
  Input,
  Kpi,
  PageHeader,
  Segmented,
  Skeleton,
  Spinner,
  cx,
} from '../components/ui';
import { UpdatedAt } from '../components/UpdatedAt';
import { Sparkline } from '../components/charts/Sparkline';
import { useShell } from '../components/layout/shell-context';

const NEAR = 0.02; // a menos de 2% do alvo

/**
 * Situação do preço-alvo — calculada no frontend.
 * Atingido quando o preço atual está no alvo ou abaixo dele (alvo de compra).
 */
export function statusAlvo(item) {
  const { precoAtual, precoAlvo } = item;
  if (!isNum(precoAlvo) || precoAlvo <= 0) return { kind: 'sem-alvo' };
  if (!isNum(precoAtual) || precoAtual <= 0) return { kind: 'sem-cotacao' };
  const distancia = precoAlvo / precoAtual - 1; // < 0: falta cair · > 0: já está abaixo
  if (precoAtual <= precoAlvo) return { kind: 'atingido', distancia };
  if (Math.abs(distancia) <= NEAR) return { kind: 'proximo', distancia };
  return { kind: 'longe', distancia };
}

export function MonitoramentoPage() {
  const acompanhamento = useAcompanhamento();
  const [filtro, setFiltro] = useState('todas');
  const [remover, setRemover] = useState(null);
  const desacompanhar = useDesacompanhar();
  const toast = useToast();

  const lista = acompanhamento.data;
  const comStatus = useMemo(() => (lista ?? []).map((item) => ({ item, status: statusAlvo(item) })), [lista]);
  const stats = useMemo(() => {
    const cotadas = comStatus.filter(({ item }) => isNum(item.variacaoPct));
    return {
      total: comStatus.length,
      alta: cotadas.filter(({ item }) => item.variacaoPct > 0).length,
      queda: cotadas.filter(({ item }) => item.variacaoPct < 0).length,
      atingidos: comStatus.filter(({ status }) => status.kind === 'atingido').length,
      proximos: comStatus.filter(({ status }) => status.kind === 'proximo').length,
    };
  }, [comStatus]);

  const visiveis = comStatus.filter(({ status }) =>
    filtro === 'todas' ? true : filtro === 'alvo' ? status.kind === 'atingido' : status.kind === 'proximo',
  );

  const confirmarRemocao = async () => {
    try {
      await desacompanhar.mutateAsync(remover.ticker);
      toast.success(`${symbol(remover.ticker)} removida do monitoramento.`);
      setRemover(null);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const loading = acompanhamento.isPending;
  const toggle = (value) => setFiltro((f) => (f === value ? 'todas' : value));

  return (
    <>
      <PageHeader
        title="Monitoramento"
        subtitle={
          <span className="flex items-center gap-2">
            Ações que você está acompanhando
            <UpdatedAt query={acompanhamento} />
          </span>
        }
      />

      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-4">
          <Kpi loading={loading} label="Monitorando" value={stats.total} hint={stats.total === 1 ? 'ação' : 'ações'} />
          <Kpi
            loading={loading}
            label="Em alta hoje"
            value={`${stats.alta} / ${stats.total}`}
            hint={`${stats.queda} em queda`}
            hintClass={stats.queda > 0 ? 'text-rose-600' : 'text-emerald-600'}
          />
          <Kpi
            loading={loading}
            label="No preço-alvo"
            value={stats.atingidos}
            hint={stats.proximos ? `Preço atual ≤ alvo · ${stats.proximos} a menos de 2%` : 'Preço atual ≤ alvo'}
            hintClass="text-emerald-600"
            onClick={() => toggle('alvo')}
            active={filtro === 'alvo'}
          />
        </div>

        <NovoMonitoramento />

        {acompanhamento.isError && !lista ? (
          <Card>
            <ErrorState error={acompanhamento.error} onRetry={() => acompanhamento.refetch()} />
          </Card>
        ) : (
          <>
            {!loading && stats.total > 0 && (
              <Segmented
                size="sm"
                value={filtro}
                onChange={setFiltro}
                options={[
                  { value: 'todas', label: `Todas (${stats.total})` },
                  { value: 'alvo', label: `No alvo (${stats.atingidos})` },
                  { value: 'proximo', label: `Próximas (${stats.proximos})` },
                ]}
              />
            )}
            <div className="grid grid-cols-3 gap-4">
              {loading && Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-60 rounded-2xl" />)}
              {visiveis.map(({ item, status }) => (
                <MonitorCard key={item.ticker} item={item} status={status} onRemove={() => setRemover(item)} />
              ))}
            </div>
            {!loading && visiveis.length === 0 && (
              <Card>
                <EmptyState icon={Eye} title={stats.total ? 'Nenhuma ação neste filtro' : 'Nenhuma ação monitorada'}>
                  {stats.total
                    ? 'Mude o filtro para ver as demais ações.'
                    : 'Adicione um código e o preço-alvo acima para começar a acompanhar.'}
                </EmptyState>
              </Card>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={remover !== null}
        title="Parar de monitorar?"
        confirmLabel="Remover"
        loading={desacompanhar.isPending}
        onCancel={() => setRemover(null)}
        onConfirm={confirmarRemocao}
        message={
          remover && (
            <>
              <strong>{symbol(remover.ticker)}</strong> será removida do monitoramento junto com o preço-alvo de{' '}
              {money(remover.precoAlvo)}.
            </>
          )
        }
      />
    </>
  );
}

function NovoMonitoramento() {
  const acompanhar = useAcompanhar();
  const toast = useToast();
  const [ticker, setTicker] = useState('');
  const [alvo, setAlvo] = useState('');
  const [errors, setErrors] = useState({});

  const submit = async (e) => {
    e.preventDefault();
    const t = normalizeTicker(ticker);
    const precoAlvo = parseDecimal(alvo);
    const next = {};
    if (!t) next.ticker = 'Informe o código.';
    else if (!isValidTicker(t)) next.ticker = 'Código inválido.';
    if (!alvo.trim()) next.alvo = 'Preço-alvo é obrigatório.';
    else if (!(precoAlvo > 0)) next.alvo = 'Informe um valor maior que zero.';
    setErrors(next);
    if (Object.keys(next).length) return;

    try {
      const res = await acompanhar.mutateAsync({ ticker: t, precoAlvo });
      toast.success(`${symbol(res?.ticker ?? t)} adicionada ao monitoramento.`);
      setTicker('');
      setAlvo('');
    } catch (err) {
      setErrors({ server: err.message });
    }
  };

  return (
    <Card className="p-4">
      <form onSubmit={submit} noValidate className="flex items-start gap-3">
        <div className="w-52">
          <Input
            placeholder="Código (ex: BBAS3)"
            aria-label="Código da ação"
            value={ticker}
            onChange={(e) => {
              setTicker(e.target.value.toUpperCase());
              setErrors({});
            }}
            invalid={!!errors.ticker}
            maxLength={24}
            disabled={acompanhar.isPending}
          />
          {errors.ticker && <p className="mt-1 text-xs text-rose-600">{errors.ticker}</p>}
        </div>
        <div className="w-52">
          <Input
            placeholder="Preço-alvo (R$)"
            aria-label="Preço-alvo"
            inputMode="decimal"
            required
            value={alvo}
            onChange={(e) => {
              setAlvo(e.target.value);
              setErrors({});
            }}
            invalid={!!errors.alvo}
            disabled={acompanhar.isPending}
          />
          {errors.alvo && <p className="mt-1 text-xs text-rose-600">{errors.alvo}</p>}
        </div>
        <Button type="submit" icon={Plus} loading={acompanhar.isPending} className="h-10">
          {acompanhar.isPending ? 'Validando ação…' : 'Monitorar'}
        </Button>
        {errors.server && <p className="self-center text-sm text-rose-600">{errors.server}</p>}
      </form>
    </Card>
  );
}

function AlvoStatus({ item, status }) {
  if (status.kind === 'sem-alvo') return <span className="text-slate-500">Sem preço-alvo</span>;
  const alvo = <span className="text-slate-500">Alvo {money(item.precoAlvo)}</span>;
  if (status.kind === 'sem-cotacao') return alvo;
  if (status.kind === 'atingido') {
    return (
      <>
        {alvo} · <span className="font-medium text-emerald-600">Atingido</span>
      </>
    );
  }
  return (
    <>
      {alvo} ·{' '}
      <span className={status.kind === 'proximo' ? 'font-medium text-amber-700' : 'text-slate-500'}>
        faltam {pct(status.distancia)}
      </span>
    </>
  );
}

function MonitorCard({ item, status, onRemove }) {
  const [editando, setEditando] = useState(false);
  const ex = exchange(item.ticker);
  const serie = item.serie ?? [];
  const dataPregao = serie[0]?.momento?.slice(0, 10);
  const up = (item.variacaoPct ?? 0) >= 0;

  return (
    <Card
      className={cx(
        'flex flex-col p-5',
        status.kind === 'atingido' && 'border-emerald-300 ring-2 ring-emerald-50',
        status.kind === 'proximo' && 'border-amber-300 ring-2 ring-amber-50',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-semibold text-slate-900">
            {symbol(item.ticker)}
            {ex && <span className="text-[10px] font-medium text-slate-400">{ex}</span>}
          </p>
          <p className="truncate text-xs text-slate-500">{item.nome ?? DASH}</p>
        </div>
        <div className="flex items-center gap-1">
          {status.kind === 'atingido' && <Badge tone="green">No alvo</Badge>}
          {status.kind === 'proximo' && <Badge tone="amber">Próximo</Badge>}
          <IconButton label={`Remover ${symbol(item.ticker)}`} icon={X} onClick={onRemove} className="-mr-2" />
        </div>
      </div>

      <div className="mt-3 flex items-end justify-between">
        <p className="text-2xl font-semibold text-slate-900 tabular-nums">
          {item.precoAtual == null ? <Skeleton className="h-8 w-28" /> : money(item.precoAtual)}
        </p>
        {item.variacaoPct != null && <ChangeBadge value={item.variacaoPct}>{pct(item.variacaoPct)}</ChangeBadge>}
      </div>

      <div className="mt-3 flex-1">
        {serie.length >= 2 ? (
          <>
            <Sparkline serie={serie} target={item.precoAlvo} up={up} />
            {dataPregao && dataPregao !== todayISO() && (
              <p className="mt-1 text-[11px] text-slate-400">Pregão de {dayMonth(dataPregao)}</p>
            )}
          </>
        ) : (
          <div className="flex h-16 items-center justify-center rounded-lg bg-slate-50 text-xs text-slate-400">
            Gráfico disponível após o primeiro registro do pregão
          </div>
        )}
      </div>

      <div className="mt-3 border-t border-slate-100 pt-3 text-xs">
        {editando ? (
          <EditarAlvo item={item} onDone={() => setEditando(false)} />
        ) : (
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5">
              <Target className="size-3.5 shrink-0 text-slate-400" />
              <span>
                <AlvoStatus item={item} status={status} />
              </span>
            </p>
            <IconButton label="Alterar preço-alvo" icon={Pencil} onClick={() => setEditando(true)} className="size-7" />
          </div>
        )}
      </div>
    </Card>
  );
}

function EditarAlvo({ item, onDone }) {
  const alterar = useAlterarAlvo();
  const toast = useToast();
  const [valor, setValor] = useState(item.precoAlvo != null ? String(item.precoAlvo).replace('.', ',') : '');
  const [erro, setErro] = useState(null);

  const salvar = async (e) => {
    e.preventDefault();
    const precoAlvo = parseDecimal(valor);
    if (!(precoAlvo > 0)) {
      setErro('Informe um valor maior que zero.');
      return;
    }
    try {
      await alterar.mutateAsync({ ticker: item.ticker, precoAlvo });
      toast.success(`Preço-alvo de ${symbol(item.ticker)} atualizado.`);
      onDone();
    } catch (err) {
      setErro(err.message);
    }
  };

  return (
    <form onSubmit={salvar} className="space-y-1">
      <div className="flex items-center gap-2">
        <Input
          autoFocus
          inputMode="decimal"
          aria-label="Novo preço-alvo"
          value={valor}
          onChange={(e) => {
            setValor(e.target.value);
            setErro(null);
          }}
          onKeyDown={(e) => e.key === 'Escape' && onDone()}
          invalid={!!erro}
          className="h-8 text-xs"
          disabled={alterar.isPending}
        />
        <IconButton type="submit" label="Salvar" icon={alterar.isPending ? Spinner : Check} disabled={alterar.isPending} />
        <IconButton label="Cancelar" icon={X} onClick={onDone} disabled={alterar.isPending} />
      </div>
      {erro && <p className="text-rose-600">{erro}</p>}
    </form>
  );
}
