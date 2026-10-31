import { useMemo, useState } from 'react';
import { money } from '../../lib/format';
import { DOWN_COLOR, UP_COLOR, linePath, useElementWidth } from './shared';

const HEIGHT = 64;
const PAD = 4;

const timeFmt = (iso) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

/**
 * Minigráfico do pregão. Linha de alvo tracejada quando o alvo cai
 * dentro (ou perto) da faixa de preços — evita achatar a série.
 */
export function Sparkline({ serie, target, up, currency }) {
  const [ref, width] = useElementWidth();
  const [hover, setHover] = useState(null);

  const geo = useMemo(() => {
    if (!width || serie.length < 2) return null;
    const prices = serie.map((p) => p.preco);
    let min = Math.min(...prices);
    let max = Math.max(...prices);
    const span = max - min || max * 0.01 || 1;
    const showTarget = target != null && target >= min - span * 0.25 && target <= max + span * 0.25;
    if (showTarget) {
      min = Math.min(min, target);
      max = Math.max(max, target);
    }
    if (min === max) {
      min -= 1;
      max += 1;
    }
    const x = (i) => PAD + (i / (serie.length - 1)) * (width - PAD * 2);
    const y = (v) => PAD + (1 - (v - min) / (max - min)) * (HEIGHT - PAD * 2);
    return { x, y, pts: serie.map((p, i) => [x(i), y(p.preco)]), targetY: showTarget ? y(target) : null };
  }, [serie, target, width]);

  const color = up ? UP_COLOR : DOWN_COLOR;
  const point = hover != null ? serie[hover] : null;

  return (
    <div ref={ref} className="relative" style={{ height: HEIGHT }}>
      {geo && (
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label="Preços do pregão"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const i = Math.round(((e.clientX - rect.left - PAD) / (width - PAD * 2)) * (serie.length - 1));
            setHover(Math.max(0, Math.min(serie.length - 1, i)));
          }}
          onMouseLeave={() => setHover(null)}
        >
          {geo.targetY != null && (
            <line x1={0} x2={width} y1={geo.targetY} y2={geo.targetY} stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 3" />
          )}
          <path d={linePath(geo.pts)} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {point && (
            <>
              <line x1={geo.x(hover)} x2={geo.x(hover)} y1={0} y2={HEIGHT} stroke="#cbd5e1" />
              <circle cx={geo.x(hover)} cy={geo.y(point.preco)} r="4" fill={color} stroke="#fff" strokeWidth="2" />
            </>
          )}
        </svg>
      )}
      {point && (
        <div
          className="pointer-events-none absolute -bottom-6 z-10 rounded-md bg-slate-900 px-2 py-1 text-[11px] whitespace-nowrap text-white tabular-nums"
          style={geo.x(hover) > width / 2 ? { right: width - geo.x(hover) } : { left: geo.x(hover) }}
        >
          {timeFmt(point.momento)} · {money(point.preco, currency)}
        </div>
      )}
    </div>
  );
}
