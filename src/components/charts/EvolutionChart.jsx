import { useId, useMemo, useState } from 'react';
import { dateBR, dayMonth, money, signedMoney, toneClass } from '../../lib/format';
import { SERIES_COLORS, linePath, niceDomain, useElementWidth } from './shared';

const HEIGHT = 260;
const M = { top: 12, right: 12, bottom: 28, left: 72 };
const PATRIMONIO = SERIES_COLORS[0];
const INVESTIDO = '#64748b'; // slate-500: referência, recessiva

const axisMoney = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});

/** Linha de patrimônio (área) + valor investido (tracejada), com crosshair e tooltip. */
export function EvolutionChart({ data }) {
  const [ref, width] = useElementWidth();
  const [hover, setHover] = useState(null);
  const gradientId = useId();

  const geo = useMemo(() => {
    if (!width || data.length < 2) return null;
    const innerW = width - M.left - M.right;
    const innerH = HEIGHT - M.top - M.bottom;
    const values = data.flatMap((d) => [d.patrimonio, d.valorInvestido]);
    const { lo, hi, ticks } = niceDomain(Math.min(...values), Math.max(...values), 4);
    const x = (i) => M.left + (i / (data.length - 1)) * innerW;
    const y = (v) => M.top + (1 - (v - lo) / (hi - lo)) * innerH;
    const pat = data.map((d, i) => [x(i), y(d.patrimonio)]);
    const inv = data.map((d, i) => [x(i), y(d.valorInvestido)]);
    const base = M.top + innerH;
    const area = `${linePath(pat)}L${pat.at(-1)[0]},${base}L${pat[0][0]},${base}Z`;
    const labelCount = Math.min(data.length, Math.max(2, Math.floor(innerW / 90)));
    const xLabels = Array.from({ length: labelCount }, (_, k) =>
      Math.round((k / (labelCount - 1)) * (data.length - 1)),
    );
    return { innerW, base, x, y, ticks, pat, inv, area, xLabels };
  }, [data, width]);

  const onMove = (e) => {
    if (!geo) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left - M.left;
    const i = Math.round((px / geo.innerW) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };

  const h = hover != null ? data[hover] : null;

  return (
    <div>
      <div className="mb-2 flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded" style={{ background: PATRIMONIO }} /> Patrimônio
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="16" height="2" aria-hidden>
            <line x1="0" y1="1" x2="16" y2="1" stroke={INVESTIDO} strokeWidth="2" strokeDasharray="4 3" />
          </svg>
          Valor investido
        </span>
      </div>

      <div ref={ref} className="relative" style={{ height: HEIGHT }}>
        {geo && (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label="Evolução do patrimônio"
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
            className="overflow-visible"
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={PATRIMONIO} stopOpacity="0.18" />
                <stop offset="100%" stopColor={PATRIMONIO} stopOpacity="0" />
              </linearGradient>
            </defs>

            {geo.ticks.map((t) => (
              <g key={t}>
                <line x1={M.left} x2={width - M.right} y1={geo.y(t)} y2={geo.y(t)} stroke="#e2e8f0" strokeWidth="1" />
                <text x={M.left - 10} y={geo.y(t)} dy="0.32em" textAnchor="end" className="fill-slate-400 text-[11px]">
                  {axisMoney.format(t)}
                </text>
              </g>
            ))}

            {geo.xLabels.map((i, k) => (
              <text
                key={i}
                x={geo.x(i)}
                y={HEIGHT - 6}
                textAnchor={k === 0 ? 'start' : k === geo.xLabels.length - 1 ? 'end' : 'middle'}
                className="fill-slate-400 text-[11px]"
              >
                {dayMonth(data[i].data)}
              </text>
            ))}

            <path d={geo.area} fill={`url(#${gradientId})`} />
            <path d={linePath(geo.inv)} fill="none" stroke={INVESTIDO} strokeWidth="2" strokeDasharray="4 3" strokeLinejoin="round" />
            <path d={linePath(geo.pat)} fill="none" stroke={PATRIMONIO} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

            {h && (
              <g pointerEvents="none">
                <line x1={geo.x(hover)} x2={geo.x(hover)} y1={M.top} y2={geo.base} stroke="#94a3b8" strokeDasharray="3 3" />
                <circle cx={geo.x(hover)} cy={geo.y(h.valorInvestido)} r="4" fill={INVESTIDO} stroke="#fff" strokeWidth="2" />
                <circle cx={geo.x(hover)} cy={geo.y(h.patrimonio)} r="4.5" fill={PATRIMONIO} stroke="#fff" strokeWidth="2" />
              </g>
            )}
          </svg>
        )}

        {h && geo && (
          <div
            className="pointer-events-none absolute top-2 z-10 w-52 rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-lg"
            style={
              geo.x(hover) > width / 2
                ? { right: width - geo.x(hover) + 12 }
                : { left: geo.x(hover) + 12 }
            }
          >
            <p className="mb-2 font-medium text-slate-900">{dateBR(h.data)}</p>
            <Row color={PATRIMONIO} label="Patrimônio" value={money(h.patrimonio)} />
            <Row color={INVESTIDO} label="Investido" value={money(h.valorInvestido)} dashed />
            <div className="mt-2 flex justify-between border-t border-slate-100 pt-2">
              <span className="text-slate-500">Resultado</span>
              <span className={`font-medium tabular-nums ${toneClass(h.patrimonio - h.valorInvestido)}`}>
                {signedMoney(h.patrimonio - h.valorInvestido)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ color, label, value, dashed }) {
  return (
    <div className="flex items-center justify-between gap-2 py-0.5">
      <span className="flex items-center gap-1.5 text-slate-500">
        <span
          className="h-0.5 w-3"
          style={dashed ? { borderTop: `2px dashed ${color}` } : { background: color }}
        />
        {label}
      </span>
      <span className="font-medium text-slate-900 tabular-nums">{value}</span>
    </div>
  );
}
