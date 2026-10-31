import { exchange, symbol } from '../lib/ticker';
import { cx } from './ui';

/** "BVMF:PETR4" → PETR4 · "NASDAQ:AAPL" → AAPL com a bolsa em destaque discreto. */
export function TickerCell({ ticker, muted }) {
  const ex = exchange(ticker);
  return (
    <span className={cx('font-semibold', muted ? 'text-slate-600' : 'text-slate-900')}>
      {symbol(ticker)}
      {ex && <span className="ml-1.5 text-[10px] font-medium text-slate-400">{ex}</span>}
    </span>
  );
}
