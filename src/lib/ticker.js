/** Mesma regra da API: letras, números, ".", "-" e ":" */
const TICKER_RE = /^[A-Z0-9.:-]{1,24}$/;

export function normalizeTicker(input) {
  return String(input ?? '').trim().toUpperCase();
}

export function isValidTicker(input) {
  return TICKER_RE.test(normalizeTicker(input));
}

/** "BVMF:PETR4" → "PETR4"; outras bolsas mantêm o código sem prefixo. */
export function symbol(ticker) {
  const t = String(ticker ?? '');
  const i = t.indexOf(':');
  return i === -1 ? t : t.slice(i + 1);
}

/** "NASDAQ:AAPL" → "NASDAQ"; B3 retorna null (é o padrão). */
export function exchange(ticker) {
  const t = String(ticker ?? '');
  const i = t.indexOf(':');
  if (i === -1) return null;
  const ex = t.slice(0, i);
  return ex === 'BVMF' ? null : ex;
}

/** Sem prefixo vira BVMF: — usado para comparar tickers digitados com os da API. */
export function fullTicker(input) {
  const t = normalizeTicker(input);
  return t.includes(':') ? t : `BVMF:${t}`;
}
