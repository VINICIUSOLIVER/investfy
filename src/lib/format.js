const currencyFormatters = new Map();

function currencyFormatter(currency) {
  if (!currencyFormatters.has(currency)) {
    currencyFormatters.set(
      currency,
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    );
  }
  return currencyFormatters.get(currency);
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

export const DASH = '—';

/** R$ 1.234,56 — null/undefined vira "—". */
export function money(value, currency = 'BRL') {
  if (!isNum(value)) return DASH;
  try {
    return currencyFormatter(currency || 'BRL').format(value);
  } catch {
    return currencyFormatter('BRL').format(value);
  }
}

/** Valor monetário com sinal explícito: +R$ 10,00 / -R$ 10,00 */
export function signedMoney(value, currency) {
  if (!isNum(value)) return DASH;
  const s = money(Math.abs(value), currency);
  if (value > 0) return `+${s}`;
  if (value < 0) return `-${s}`;
  return s;
}

const pctFormatter = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Percentual vindo em DECIMAL (0.125 → 12,50%). */
export function pct(decimal, { sign = true } = {}) {
  if (!isNum(decimal)) return DASH;
  const v = decimal * 100;
  const prefix = sign && v > 0 ? '+' : '';
  return `${prefix}${pctFormatter.format(v)}%`;
}

const numberFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 8 });
export function num(value) {
  return isNum(value) ? numberFormatter.format(value) : DASH;
}

const compactFormatter = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
export function compact(value) {
  return isNum(value) ? compactFormatter.format(value) : DASH;
}

/** "2026-10-31" → "31/10/2026" (sem Date para não sofrer com fuso). */
export function dateBR(iso) {
  if (typeof iso !== 'string') return DASH;
  const [y, m, d] = iso.slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

/** "2026-10-31" → "31/10" */
export function dayMonth(iso) {
  if (typeof iso !== 'string') return DASH;
  const [, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}`;
}

export function time(date) {
  if (!date) return DASH;
  return new Date(date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function dateTime(iso) {
  if (!iso) return DASH;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return DASH;
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Data de hoje no fuso local, formato AAAA-MM-DD. */
export function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Converte entrada do usuário em número aceitando o formato brasileiro.
 * "1.234,56" → 1234.56 · "35,2" → 35.2 · "35.20" → 35.2
 */
export function parseDecimal(input) {
  if (typeof input === 'number') return input;
  let s = String(input ?? '').trim().replace(/[R$\s]/g, '');
  if (!s) return NaN;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  if (!/^-?\d*\.?\d+$/.test(s)) return NaN;
  return Number(s);
}

/** Classe de cor para valores positivos/negativos. */
export function toneClass(value) {
  if (!isNum(value) || value === 0) return 'text-slate-500';
  return value > 0 ? 'text-emerald-600' : 'text-rose-600';
}

export { isNum };
