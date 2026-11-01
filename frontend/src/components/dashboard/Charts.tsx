import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { SensorStat, UnitDetail } from '@/lib/types'
import { fmt } from '@/lib/utils'

const AXIS = { fontSize: 12, fill: '#586373' } as const
const GRID = '#e3e8ee'

/** Predicted RUL at each cycle the file contains, with the alert thresholds drawn and labelled. */
export function RulChart({ series, thresholds }: { series: UnitDetail['rul_series']; thresholds: { critical: number; warning: number } }) {
  const data = series.map((p) => ({ cycle: p.cycle, rul: p.rul }))
  const first = data[0], last = data[data.length - 1]
  const summary = `Predicted remaining useful life across ${data.length} plotted cycles, from ${fmt(first.rul, 0)} at cycle ${first.cycle} to ${fmt(last.rul, 0)} at cycle ${last.cycle}.`
  return (
    <figure>
      <div role="img" aria-label={summary} className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="cycle" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={32} label={{ value: 'Cycle', position: 'insideBottomRight', offset: -2, style: AXIS }} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} />
            <Tooltip formatter={(v) => [`${fmt(Number(v), 1)} cycles`, 'Predicted RUL']} labelFormatter={(l) => `Cycle ${l}`} contentStyle={{ borderRadius: 12, border: '1px solid #d9dfe7', fontSize: 13 }} />
            <ReferenceLine y={thresholds.warning} stroke="#a35f00" strokeDasharray="6 4" label={{ value: `Watch ≤ ${thresholds.warning}`, position: 'insideTopRight', fill: '#7a4600', fontSize: 11 }} />
            <ReferenceLine y={thresholds.critical} stroke="#c0392b" strokeDasharray="2 3" label={{ value: `Act now ≤ ${thresholds.critical}`, position: 'insideTopRight', fill: '#a02b20', fontSize: 11 }} />
            <Line type="monotone" dataKey="rul" stroke="#0a6bd6" strokeWidth={2.25} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">{summary}</figcaption>
    </figure>
  )
}

/** One small chart per sensor, each on its own scale so a small drift is not flattened by a large one. */
export function SensorChart({ stat, cycles, values }: { stat: SensorStat; cycles: number[]; values: number[] }) {
  const data = cycles.map((c, i) => ({ cycle: c, v: values[i] }))
  const change = stat.change_pct
  const summary = `${stat.symbol}, ${stat.label}: ${fmt(stat.first, 3)} at the first reading to ${fmt(stat.last, 3)} at the last${change == null ? '' : `, a change of ${change > 0 ? '+' : ''}${fmt(change, 2)} percent`}.`
  return (
    <figure className="rounded-xl border border-border bg-white p-3">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="min-w-0">
          <span className="font-medium">{stat.symbol}</span>
          <span className="ml-1.5 text-xs text-muted-foreground">{stat.sensor}</span>
          <span className="block truncate text-xs text-muted-foreground" title={stat.label}>{stat.label}</span>
        </span>
        <span className="tabular shrink-0 text-xs text-muted-foreground">{change == null ? '–' : `${change > 0 ? '+' : ''}${fmt(change, 2)}%`}</span>
      </figcaption>
      <div role="img" aria-label={summary} className="mt-2 h-24 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
            <YAxis hide domain={['auto', 'auto']} />
            <XAxis dataKey="cycle" hide />
            <Tooltip formatter={(v) => [fmt(Number(v), 3), stat.symbol]} labelFormatter={(l) => `Cycle ${l}`} contentStyle={{ borderRadius: 10, border: '1px solid #d9dfe7', fontSize: 12 }} />
            <Line type="monotone" dataKey="v" stroke="#5b6b8c" strokeWidth={1.75} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}
