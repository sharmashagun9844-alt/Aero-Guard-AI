import type { Alert, PredictionResult, Status, UnitResult } from './types'
import { SENSOR_META } from './sensors'

/**
 * DEMONSTRATION DATA ONLY.
 * Everything here is generated in the browser from a seeded random generator so the dashboard can be previewed
 * without a backend. None of it comes from the NASA dataset or from rul_model.joblib, and the "predicted RUL"
 * values are simply the synthetic ground truth with noise. The UI labels it as demonstration data wherever it shows.
 */
function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SHOWN = ['s2', 's3', 's4', 's7', 's11', 's12'] as const
const BASE: Record<string, [number, number]> = { s2: [642.4, 1.9], s3: [1589, 9], s4: [1405, 8], s7: [554, -2.1], s11: [47.4, 0.9], s12: [521.6, -1.8] }
const NOISE: Record<string, number> = { s2: 0.15, s3: 1.6, s4: 1.3, s7: 0.12, s11: 0.07, s12: 0.1 }

export function makeDemoResult(thresholds = { critical: 30, warning: 75 }): PredictionResult {
  const rand = mulberry32(2718)
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand())
  const lifetimes = [210, 188, 236, 172, 205]
  const observed = [196, 132, 88, 165, 40]

  const units: UnitResult[] = lifetimes.map((life, i) => {
    const n = observed[i]
    const cycles = Array.from({ length: n }, (_, k) => k + 1)
    const rulTrue = cycles.map((c) => life - c)
    const step = Math.max(1, Math.floor(n / 80))
    const idx = cycles.map((_, k) => k).filter((k) => k % step === 0 || k === n - 1)
    const series: Record<string, number[]> = {}
    for (const s of SHOWN) {
      const [b, drift] = BASE[s]
      series[s] = idx.map((k) => +(b + drift * Math.pow(cycles[k] / life, 2.2) * 6 + gauss() * NOISE[s]).toFixed(3))
    }
    const rulSeries = idx.map((k) => ({ cycle: cycles[k], rul: +Math.max(0, rulTrue[k] + gauss() * 4).toFixed(1) }))
    const rul = rulSeries[rulSeries.length - 1].rul
    const status: Status = rul <= thresholds.critical ? 'critical' : rul <= thresholds.warning ? 'warning' : 'healthy'
    return {
      unit: i + 1, cycles_observed: n, last_cycle: n, predicted_rul: rul, status,
      detail: {
        rul_series: rulSeries,
        sensor_cycles: idx.map((k) => cycles[k]),
        sensor_series: series,
        sensor_stats: SHOWN.map((s) => {
          const f = series[s][0], l = series[s][series[s].length - 1]
          return { sensor: s, symbol: SENSOR_META[s].symbol, label: SENSOR_META[s].label, first: f, last: l, change_pct: +(((l - f) / Math.abs(f)) * 100).toFixed(3) }
        }),
        alerts: status === 'healthy' ? [] : ([{
          level: status === 'critical' ? 'critical' : 'warning', source: 'model',
          title: status === 'critical' ? 'Remaining life is within the critical threshold' : 'Remaining life is within the warning threshold',
          detail: `Demonstration value of ${rul.toFixed(0)} cycles against a threshold of ${status === 'critical' ? thresholds.critical : thresholds.warning}.`,
        }] as Alert[]),
      },
    }
  }).sort((a, b) => a.predicted_rul - b.predicted_rul)

  const counts: Record<Status, number> = { healthy: 0, warning: 0, critical: 0 }
  units.forEach((u) => counts[u.status]++)
  return {
    filename: 'Demonstration data (synthetic)', rows: observed.reduce((a, b) => a + b, 0), engines: units.length,
    warnings: [], status_counts: counts, thresholds, detail_limit: units.length,
    model: { estimator_class: 'none (synthetic)', n_features: 0, feature_source: null }, units,
  }
}
