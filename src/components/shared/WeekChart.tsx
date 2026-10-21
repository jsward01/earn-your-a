import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { weekLabel } from "../../lib/progress";

export interface ChartPoint {
  week: string;
  value: number;
  /** Tooltip / table lines under the value (e.g. "4 graded", "+$15 earned · −$10 lost"). */
  detail: string;
}

interface WeekChartProps {
  kind: "line" | "columns";
  points: ChartPoint[];
  /** Names what's plotted, for screen readers and the table header. */
  label: string;
  /** How a value is written on the axis, in labels and tooltips. */
  format: (n: number) => string;
  /** Line charts: a fixed 0–max scale (grades use 100). */
  max?: number;
  /** A horizontal reference line (e.g. the pass mark), drawn a step darker than the grid and labeled on the axis. */
  reference?: number;
}

const PLOT_H = 150;
const AXIS_H = 22;
const LEFT = 40;
const RIGHT = 12;
const TOP = 16;

/** Round up to a clean axis number (5, 10, 20, 25, 50, 100…). */
function niceCeil(n: number): number {
  if (n <= 0) return 0;
  const p = 10 ** Math.floor(Math.log10(n));
  return ([1, 2, 2.5, 5, 10].find(s => s * p >= n) ?? 10) * p;
}

/**
 * A week-by-week chart (one series): a 2px line with ringed points, or columns (≤24px, rounded at the data end,
 * blue up / red down from a zero baseline). Hover or tap shows a crosshair and readout; arrow keys step through
 * weeks when focused; "Show as table" lists every value. Colors come from the `.viz` tokens in index.css.
 */
export function WeekChart({ kind, points, label, format, max, reference }: WeekChartProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const [active, setActive] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(240, el.clientWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (points.length === 0) return null;

  const plotW = width - LEFT - RIGHT;
  const values = points.map(p => p.value);
  const hi = max ?? niceCeil(Math.max(0, ...values));
  const lo = kind === "columns" ? -niceCeil(Math.max(0, ...values.map(v => -v))) : 0;
  const span = hi - lo || 1;
  const y = (v: number) => TOP + ((hi - v) / span) * PLOT_H;
  const step = plotW / points.length;
  const x = (i: number) => LEFT + step * (i + 0.5);
  const barW = Math.min(24, Math.max(4, step - 2));
  const ticks = kind === "columns"
    ? [...new Set([hi, 0, lo])]
    : [...new Set([0, 50, 100, ...(reference !== undefined ? [reference] : [])])].filter(t => t <= hi && (t === reference || reference === undefined || Math.abs(y(t) - y(reference)) >= 14));
  // At most ~5 week labels, always including the last.
  const every = Math.max(1, Math.ceil(points.length / 5));
  const showLabel = (i: number) => (points.length - 1 - i) % every === 0;
  const last = points.length - 1;

  function pick(e: PointerEvent<SVGRectElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const i = Math.floor((e.clientX - box.left) / step);
    setActive(Math.min(last, Math.max(0, i)));
  }
  function onKey(e: KeyboardEvent<SVGSVGElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    setActive(a => (a === null ? last : Math.min(last, Math.max(0, a + (e.key === "ArrowRight" ? 1 : -1)))));
  }

  const linePath = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.value)}`).join(" ");
  const column = (v: number, i: number) => {
    // Rounded 4px at the data end, square at the zero baseline.
    const x0 = x(i) - barW / 2, x1 = x0 + barW, base = y(0), tip = y(v);
    const r = Math.min(4, Math.abs(base - tip), barW / 2);
    if (v === 0) return "";
    return v > 0
      ? `M${x0},${base} V${tip + r} Q${x0},${tip} ${x0 + r},${tip} H${x1 - r} Q${x1},${tip} ${x1},${tip + r} V${base} Z`
      : `M${x0},${base} V${tip - r} Q${x0},${tip} ${x0 + r},${tip} H${x1 - r} Q${x1},${tip} ${x1},${tip - r} V${base} Z`;
  };

  const tip = active !== null ? points[active] : null;
  const tipLeft = active !== null ? Math.min(Math.max(x(active), 70), width - 70) : 0;

  return (
    <div className="viz">
      <div ref={wrap} className="relative">
        <svg width={width} height={TOP + PLOT_H + AXIS_H} role="img" tabIndex={0} aria-label={`${label}, ${points.length} weeks. Use the arrow keys to read each week.`}
          onKeyDown={onKey} onBlur={() => setActive(null)} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 rounded">
          {ticks.map(t => (
            <g key={t}>
              <line x1={LEFT} x2={width - RIGHT} y1={y(t)} y2={y(t)} stroke={(t === 0 && kind === "columns") || t === reference ? "var(--viz-axis)" : "var(--viz-grid)"} strokeWidth={1} />
              {(t === 0 || Math.abs(y(t) - y(0)) >= 14) && <text x={LEFT - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--viz-muted)" style={{ fontVariantNumeric: "tabular-nums" }}>{format(t)}</text>}
            </g>
          ))}
          {active !== null && <line x1={x(active)} x2={x(active)} y1={TOP} y2={TOP + PLOT_H} stroke="var(--viz-axis)" strokeWidth={1} />}

          {kind === "line" ? (
            <>
              <path d={linePath} fill="none" stroke="var(--viz-series)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {points.map((p, i) => (
                <circle key={p.week} cx={x(i)} cy={y(p.value)} r={active === i ? 5.5 : 4} fill="var(--viz-series)" stroke="var(--viz-surface)" strokeWidth={2} />
              ))}
              <text x={Math.min(x(last) + 8, width - RIGHT)} y={y(points[last].value) - 10} textAnchor={x(last) + 40 > width ? "end" : "start"}
                fontSize={12} fontWeight={600} fill="var(--viz-ink)">{format(points[last].value)}</text>
            </>
          ) : (
            <>
              {points.map((p, i) => (
                <path key={p.week} d={column(p.value, i)} fill={p.value >= 0 ? "var(--viz-series)" : "var(--viz-negative)"} opacity={active === null || active === i ? 1 : 0.55} />
              ))}
              {points[last].value !== 0 && (
                <text x={x(last)} y={points[last].value > 0 ? y(points[last].value) - 6 : y(points[last].value) + 14} textAnchor="middle"
                  fontSize={12} fontWeight={600} fill="var(--viz-ink)">{format(points[last].value)}</text>
              )}
            </>
          )}

          {points.map((p, i) => showLabel(i) && (
            <text key={p.week} x={x(i)} y={TOP + PLOT_H + 16} textAnchor="middle" fontSize={11} fill="var(--viz-muted)">{weekLabel(p.week)}</text>
          ))}
          {/* Hit layer: the whole plot, so the pointer only has to be over the right week. */}
          <rect x={LEFT} y={0} width={plotW} height={TOP + PLOT_H} fill="transparent"
            onPointerMove={pick} onPointerDown={pick} onPointerLeave={e => e.pointerType === "mouse" && setActive(null)} />
        </svg>

        {tip && (
          <div className="absolute pointer-events-none bg-white border border-gray-200 rounded-lg shadow px-2.5 py-1.5 text-xs -translate-x-1/2"
            style={{ left: tipLeft, top: 0 }}>
            <p className="font-bold text-gray-800 text-sm">{format(tip.value)}</p>
            <p className="text-gray-500">Week of {weekLabel(tip.week)}</p>
            <p className="text-gray-400">{tip.detail}</p>
          </div>
        )}
      </div>

      <details className="mt-1">
        <summary className="text-xs text-indigo-600 cursor-pointer">Show as table</summary>
        <table className="mt-2 w-full text-xs">
          <thead><tr className="text-gray-400 text-left"><th className="font-medium py-1">Week of</th><th className="font-medium py-1 text-right">{label}</th><th className="font-medium py-1 pl-3">Details</th></tr></thead>
          <tbody>
            {points.map(p => (
              <tr key={p.week} className="border-t border-gray-100 text-gray-600">
                <td className="py-1">{weekLabel(p.week)}</td>
                <td className="py-1 text-right font-semibold text-gray-800" style={{ fontVariantNumeric: "tabular-nums" }}>{format(p.value)}</td>
                <td className="py-1 pl-3 text-gray-400">{p.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
