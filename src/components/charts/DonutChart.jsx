import { useState } from 'react';
import { money } from '../../lib/format';

const SIZE = 180;
const STROKE = 28;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;
const GAP = 2; // espaço de 2px entre fatias

const pctFmt = new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });

/**
 * Rosca de alocação. `slices`: [{ key, label, value, color }] já ordenado.
 * Legenda sempre visível (identidade nunca só pela cor) + destaque no hover.
 */
export function DonutChart({ slices }) {
  const [active, setActive] = useState(null);
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (!total) return null;

  let offset = 0;
  const arcs = slices.map((s) => {
    const len = (s.value / total) * C;
    const arc = { ...s, len, offset, share: s.value / total };
    offset += len;
    return arc;
  });
  const focus = arcs.find((a) => a.key === active);
  const multi = arcs.length > 1;

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative">
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="Alocação da carteira">
          <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
            {arcs.map((a) => (
              <circle
                key={a.key}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={R}
                fill="none"
                stroke={a.color}
                strokeWidth={a.key === active ? STROKE + 4 : STROKE}
                strokeDasharray={`${Math.max(a.len - (multi ? GAP : 0), 0.5)} ${C}`}
                strokeDashoffset={-a.offset}
                opacity={active && a.key !== active ? 0.35 : 1}
                className="cursor-pointer transition-[opacity,stroke-width] duration-150"
                onMouseEnter={() => setActive(a.key)}
                onMouseLeave={() => setActive(null)}
              />
            ))}
          </g>
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xs text-slate-500">{focus ? focus.label : 'Total'}</span>
          <span className="text-sm font-semibold text-slate-900 tabular-nums">
            {focus ? pctFmt.format(focus.share) : money(total)}
          </span>
        </div>
      </div>

      <ul className="w-full space-y-1.5 text-sm">
        {arcs.map((a) => (
          <li
            key={a.key}
            onMouseEnter={() => setActive(a.key)}
            onMouseLeave={() => setActive(null)}
            className={`flex items-center justify-between gap-3 rounded-md px-1.5 py-0.5 ${a.key === active ? 'bg-slate-50' : ''}`}
          >
            <span className="flex min-w-0 items-center gap-2 text-slate-700">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: a.color }} />
              <span className="truncate">{a.label}</span>
            </span>
            <span className="text-slate-500 tabular-nums" title={money(a.value)}>
              {pctFmt.format(a.share)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
