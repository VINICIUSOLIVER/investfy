import { useEffect, useState } from 'react';
import { Plus, RotateCw, Search } from 'lucide-react';
import { useCotacao } from '../hooks/queries';
import { DASH, compact, dateTime, isNum, money, num, pct, signedMoney, toneClass } from '../lib/format';
import { exchange, isValidTicker, normalizeTicker, symbol } from '../lib/ticker';
import { Badge, Button, ChangeBadge, ErrorState, IconButton, Input, Modal, Skeleton, Spinner } from './ui';
import { useShell } from './layout/shell-context';
import { ErrorBoundary } from './ErrorBoundary';

const DEBOUNCE_MS = 800; // a rota de cotação é lenta: não consultar a cada tecla
const MIN_LENGTH = 3;

export function SearchModal({ open, onClose, initialTicker }) {
  return (
    <Modal open={open} onClose={onClose} title="Buscar ação" description="Cotação e informações em tempo quase real (atraso de até ~20 min)." width="max-w-2xl">
      <ErrorBoundary>
        <SearchContent initialTicker={initialTicker} />
      </ErrorBoundary>
    </Modal>
  );
}

function SearchContent({ initialTicker }) {
  const [text, setText] = useState(initialTicker);
  const [ticker, setTicker] = useState(initialTicker && isValidTicker(initialTicker) ? normalizeTicker(initialTicker) : '');

  const candidate = normalizeTicker(text);
  const ready = candidate.length >= MIN_LENGTH && isValidTicker(candidate);

  // Debounce: só consulta quando o usuário para de digitar
  useEffect(() => {
    if (!ready || candidate === ticker) return undefined;
    const t = setTimeout(() => setTicker(candidate), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [candidate, ready, ticker]);

  const query = useCotacao(ticker);

  const search = () => {
    if (!ready) return;
    if (candidate === ticker) query.refetch();
    else setTicker(candidate); // consulta na hora, sem esperar o debounce
  };

  return (
    <div className="space-y-5">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
      >
        <div className="flex-1">
          <Input
            data-autofocus
            icon={Search}
            placeholder="Digite o código (ex: PETR4, NASDAQ:AAPL)"
            value={text}
            onChange={(e) => setText(e.target.value.toUpperCase())}
            maxLength={24}
            autoComplete="off"
            spellCheck={false}
            invalid={Boolean(text) && !isValidTicker(candidate)}
          />
        </div>
        <Button type="submit" className="h-10" disabled={!ready} loading={query.isFetching}>
          Buscar
        </Button>
      </form>

      {!ticker && (
        <p className="py-8 text-center text-sm text-slate-500">
          Digite o código e pressione Enter. Sem prefixo, consideramos a B3 (BVMF).
        </p>
      )}
      {ticker && query.isPending && <LoadingCotacao key={ticker} ticker={ticker} />}
      {ticker && query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
      {ticker && query.data && (
        <CotacaoDetails data={query.data} fetching={query.isFetching} updatedAt={query.dataUpdatedAt} onRefresh={() => query.refetch()} />
      )}
    </div>
  );
}

/** Segundos desde a montagem — a rota de cotação pode demorar. */
function useElapsed() {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return secs;
}

function LoadingCotacao({ ticker }) {
  const secs = useElapsed();
  return (
    <div className="space-y-4" aria-busy>
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Spinner /> Consultando {ticker}… isso pode levar alguns segundos.
        <span className="ml-auto text-xs text-slate-400 tabular-nums">{secs}s</span>
      </div>
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
    </div>
  );
}

function CotacaoDetails({ data, fetching, updatedAt, onRefresh }) {
  const { openLancamento } = useShell();
  const cur = data.moeda || 'BRL';
  const ex = exchange(data.ticker);
  const m = (v) => money(v, cur);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-semibold text-slate-900">{symbol(data.ticker)}</h3>
            {ex && <Badge>{ex}</Badge>}
            {data.posicao?.quantidade > 0 && <Badge tone="blue">Na carteira</Badge>}
          </div>
          <p className="truncate text-sm text-slate-500">{data.nome ?? DASH}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold text-slate-900 tabular-nums">{m(data.precoAtual)}</p>
          <div className="mt-1 flex items-center justify-end gap-2 text-sm">
            <span className={`tabular-nums ${toneClass(data.variacao)}`}>{signedMoney(data.variacao, cur)}</span>
            <ChangeBadge value={data.variacaoPct}>{pct(data.variacaoPct)}</ChangeBadge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Abertura" value={m(data.abertura)} />
        <Stat label="Fech. anterior" value={m(data.fechamentoAnterior)} />
        <Stat label="Volume" value={compact(data.volume)} />
        <Stat label="Máxima do dia" value={m(data.maxDia)} />
        <Stat label="Mínima do dia" value={m(data.minDia)} />
        <Stat label="Valor de mercado" value={isNum(data.valorMercado) ? `${cur} ${compact(data.valorMercado)}` : DASH} />
        <Stat label="P/L" value={isNum(data.pl) ? num(Math.round(data.pl * 100) / 100) : DASH} />
        <Stat label="LPA" value={m(data.lpa)} />
        <Stat label="Moeda" value={data.moeda ?? DASH} />
      </div>

      <RangeBar label="Faixa de 52 semanas" min={data.min52} max={data.max52} value={data.precoAtual} format={m} />

      {data.posicao && <PosicaoResumo posicao={data.posicao} />}

      <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <p className="flex items-center gap-1 text-xs text-slate-500">
          Última negociação: {dateTime(data.ultimaNegociacao)}
          <IconButton
            label="Atualizar cotação"
            icon={fetching ? Spinner : RotateCw}
            onClick={onRefresh}
            disabled={fetching}
            className="size-6"
          />
          {updatedAt ? <span className="text-slate-400">· consultado às {new Date(updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span> : null}
        </p>
        <Button icon={Plus} onClick={() => openLancamento({ ticker: ex ? data.ticker : symbol(data.ticker) })}>
          Novo lançamento
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2.5">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-slate-900 tabular-nums">{value}</p>
    </div>
  );
}

function RangeBar({ label, min, max, value, format }) {
  if (!isNum(min) || !isNum(max) || max <= min) return null;
  const pos = Math.min(Math.max((value - min) / (max - min), 0), 1) * 100;
  return (
    <div>
      <p className="mb-2 text-xs text-slate-500">{label}</p>
      <div className="relative h-1.5 rounded-full bg-slate-200">
        <span
          className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-blue-600 shadow"
          style={{ left: `${pos}%` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-slate-500 tabular-nums">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  );
}

function PosicaoResumo({ posicao: p }) {
  const encerrada = p.quantidade === 0;
  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
      <p className="mb-3 text-sm font-medium text-slate-900">
        Sua posição {encerrada && <span className="font-normal text-slate-500">(encerrada)</span>}
      </p>
      <div className="grid grid-cols-4 gap-3 text-sm">
        <Mini label="Quantidade" value={num(p.quantidade)} />
        <Mini label="Preço médio" value={money(p.precoMedio)} />
        <Mini label="Valor atual" value={money(p.valorAtual)} />
        {encerrada ? (
          <Mini label="Lucro realizado" value={signedMoney(p.lucroRealizado)} className={toneClass(p.lucroRealizado)} />
        ) : (
          <Mini
            label="Resultado"
            value={`${signedMoney(p.rentabilidade)} (${pct(p.rentabilidadePct)})`}
            className={toneClass(p.rentabilidade)}
          />
        )}
      </div>
    </div>
  );
}

function Mini({ label, value, className = 'text-slate-900' }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-0.5 font-medium tabular-nums ${className}`}>{value}</p>
    </div>
  );
}
