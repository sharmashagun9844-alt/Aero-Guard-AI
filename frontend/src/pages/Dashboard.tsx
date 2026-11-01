import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, ArrowRight, BellRing, Cpu, FlaskConical, Gauge, Info, Plane, Upload, WifiOff } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/dashboard/StatusBadge'
import { RulChart, SensorChart } from '@/components/dashboard/Charts'
import { useAnalysis } from '@/lib/analysis-store'
import { makeDemoResult } from '@/lib/demo'
import { useApiStatus } from '@/hooks/use-api-status'
import { cn, fmt } from '@/lib/utils'
import type { PredictionResult, UnitResult } from '@/lib/types'

function ApiChip() {
  const s = useApiStatus()
  if (s.kind === 'checking') return <Badge><Activity className="size-3.5" aria-hidden /> Checking API…</Badge>
  if (s.kind === 'offline') return <Badge variant="critical"><WifiOff className="size-3.5" aria-hidden /> API offline</Badge>
  if (s.kind === 'no-model') return <Badge variant="warning"><Cpu className="size-3.5" aria-hidden /> API online · model not loaded</Badge>
  return <Badge variant="healthy"><Cpu className="size-3.5" aria-hidden /> API online · model loaded</Badge>
}

function Metric({ label, value, hint, icon: Icon }: { label: string; value: string; hint?: string; icon: typeof Gauge }) {
  return (
    <div className="surface p-5">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{label}</span>
        <Icon className="size-4" aria-hidden />
      </div>
      <p className="tabular mt-2 font-display text-3xl font-light tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function EmptyState({ onDemo }: { onDemo: () => void }) {
  return (
    <div className="surface mx-auto mt-10 max-w-2xl p-8 text-center md:p-12">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent text-accent-foreground"><Plane className="size-6" aria-hidden /></span>
      <h2 className="mt-5 text-2xl font-normal">No engine data yet</h2>
      <p className="mx-auto mt-3 max-w-md text-muted-foreground">
        The dashboard shows what the model predicts for the file you analyse. Upload sensor readings to begin, or look around with clearly labelled demonstration data first.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Button asChild variant="primary" size="lg"><Link to="/analyze"><Upload /> Analyze a sensor file</Link></Button>
        <Button variant="secondary" size="lg" onClick={onDemo}><FlaskConical /> Preview with demo data</Button>
      </div>
    </div>
  )
}

function FleetTable({ units, selected, onSelect }: { units: UnitResult[]; selected: number | null; onSelect: (u: number) => void }) {
  return (
    <div className="surface overflow-hidden">
      <div className="max-h-[34rem] overflow-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Engines ranked by predicted remaining useful life, shortest first</caption>
          <thead className="sticky top-0 bg-white text-left text-xs text-muted-foreground">
            <tr className="border-b border-border">
              <th scope="col" className="px-4 py-3 font-medium">Engine</th>
              <th scope="col" className="px-2 py-3 font-medium">Status</th>
              <th scope="col" className="px-2 py-3 text-right font-medium">RUL (cycles)</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Observed</th>
            </tr>
          </thead>
          <tbody>
            {units.map((u) => (
              <tr key={u.unit} className={cn('border-b border-border/60 last:border-0', selected === u.unit && 'bg-accent/60')}>
                <th scope="row" className="px-4 py-0 font-medium">
                  <button type="button" onClick={() => onSelect(u.unit)} aria-pressed={selected === u.unit} className="-my-px flex min-h-11 w-full items-center whitespace-nowrap text-left">
                    Engine {u.unit}
                  </button>
                </th>
                <td className="px-2"><StatusBadge status={u.status} /></td>
                <td className="tabular px-2 text-right">{fmt(u.predicted_rul, 1)}</td>
                <td className="tabular px-4 text-right text-muted-foreground">{fmt(u.cycles_observed)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Detail({ unit, result, source }: { unit: UnitResult; result: PredictionResult; source: 'upload' | 'demo' }) {
  const [all, setAll] = useState(false)
  const d = unit.detail
  const label = source === 'demo' ? 'Demo value' : 'Predicted RUL'

  const ranked = useMemo(() => (d ? [...d.sensor_stats].sort((a, b) => Math.abs(b.change_pct ?? 0) - Math.abs(a.change_pct ?? 0)) : []), [d])
  const shown = all ? ranked : ranked.slice(0, 6)

  return (
    <section className="space-y-5" aria-labelledby="engine-title">
      <div className="surface p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="engine-title" className="text-2xl font-normal">Engine {unit.unit}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{fmt(unit.cycles_observed)} cycles observed, last cycle {fmt(unit.last_cycle)}</p>
          </div>
          <StatusBadge status={unit.status} />
        </div>
        <div className="mt-5 flex items-end gap-3">
          <p className="tabular font-display text-6xl font-light leading-none tracking-tight">{fmt(unit.predicted_rul, 0)}</p>
          <p className="pb-1 text-sm text-muted-foreground">cycles remaining<br /><span className="text-xs">{label}, at the last cycle in the file</span></p>
        </div>
      </div>

      {!d ? (
        <Alert variant="info"><Info aria-hidden /><p>Charts are drawn for the {result.detail_limit} engines with the shortest remaining life. This engine's prediction is shown above.</p></Alert>
      ) : (
        <>
          <div className="surface p-5 md:p-6">
            <h3 className="font-display text-[15px] font-medium">Remaining life over time</h3>
            <p className="mb-3 mt-1 text-sm text-muted-foreground">
              {source === 'demo' ? 'Synthetic demonstration curve. ' : 'The model scored each row; this is its output at every plotted cycle. '}
              Threshold lines are AeroGuard alert defaults, not model or NASA values.
            </p>
            <RulChart series={d.rul_series} thresholds={result.thresholds} />
          </div>

          <div className="surface p-5 md:p-6">
            <h3 className="flex items-center gap-2 font-display text-[15px] font-medium"><BellRing className="size-4" aria-hidden /> Alerts</h3>
            {d.alerts.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No alerts for this engine. Its predicted life is above the warning threshold and no sensor shows a large drift from its early baseline.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {d.alerts.map((a, i) => (
                  <li key={i}>
                    <Alert variant={a.level === 'critical' ? 'error' : a.level === 'warning' ? 'warning' : 'info'}>
                      <Info aria-hidden />
                      <div>
                        <p className="flex flex-wrap items-center gap-2 font-medium">
                          {a.title}
                          <Badge variant="neutral" className="bg-white/70">{a.source === 'model' ? 'From prediction' : 'Rule-based check'}</Badge>
                        </p>
                        <p className="mt-1">{a.detail}</p>
                      </div>
                    </Alert>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="surface p-5 md:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-display text-[15px] font-medium">Sensor trends</h3>
              {ranked.length > 6 && (
                <Button size="sm" variant="ghost" onClick={() => setAll((v) => !v)} aria-pressed={all}>{all ? 'Show top 6' : `Show all ${ranked.length}`}</Button>
              )}
            </div>
            <p className="mb-4 mt-1 text-sm text-muted-foreground">Sensors with the largest change from first to last reading come first. Each chart has its own scale.</p>
            {shown.length === 0 ? (
              <p className="text-sm text-muted-foreground">Every sensor in this file is constant, so there are no trends to draw.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {shown.map((s) => <SensorChart key={s.sensor} stat={s} cycles={d.sensor_cycles} values={d.sensor_series[s.sensor]} />)}
              </div>
            )}
            {ranked.length > 0 && (
              <details className="mt-5 text-sm">
                <summary className="cursor-pointer font-medium">View sensor values as a table</summary>
                <div className="mt-3 max-h-72 overflow-auto rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-white text-left text-xs text-muted-foreground">
                      <tr><th scope="col" className="px-3 py-2 font-medium">Sensor</th><th scope="col" className="px-3 py-2 text-right font-medium">First</th><th scope="col" className="px-3 py-2 text-right font-medium">Last</th><th scope="col" className="px-3 py-2 text-right font-medium">Change</th></tr>
                    </thead>
                    <tbody>
                      {ranked.map((s) => (
                        <tr key={s.sensor} className="border-t border-border/60">
                          <th scope="row" className="px-3 py-2 text-left font-normal">{s.symbol} <span className="text-muted-foreground">({s.sensor})</span></th>
                          <td className="tabular px-3 py-2 text-right">{fmt(s.first, 3)}</td>
                          <td className="tabular px-3 py-2 text-right">{fmt(s.last, 3)}</td>
                          <td className="tabular px-3 py-2 text-right">{s.change_pct == null ? '–' : `${s.change_pct > 0 ? '+' : ''}${fmt(s.change_pct, 2)}%`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </div>
        </>
      )}
    </section>
  )
}

export default function Dashboard() {
  const { result, source, setAnalysis, clear } = useAnalysis()
  const [selected, setSelected] = useState<number | null>(null)
  useEffect(() => { document.title = 'Dashboard · AeroGuard AI' }, [])

  const current = result?.units.find((u) => u.unit === selected) ?? result?.units[0] ?? null
  const shortest = result?.units[0]
  const startDemo = () => { setSelected(null); setAnalysis(makeDemoResult(), 'demo') }

  return (
    <main id="main" className="studio-bg min-h-svh pb-20 pt-24">
      <div className="container-x">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-normal md:text-5xl">Fleet dashboard</h1>
            <p className="mt-3 text-muted-foreground">Remaining useful life, sensor trends and alerts for every engine in the file you analysed.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ApiChip />
            {result && (
              <>
                <Button asChild variant="secondary" size="sm"><Link to="/analyze">New analysis</Link></Button>
                <Button variant="ghost" size="sm" onClick={() => { clear(); setSelected(null) }}>Clear</Button>
              </>
            )}
          </div>
        </header>

        {!result || !source || !current ? (
          <EmptyState onDemo={startDemo} />
        ) : (
          <div className="mt-8 space-y-6">
            {source === 'demo' ? (
              <Alert variant="demo">
                <FlaskConical aria-hidden />
                <p><strong>Demonstration data.</strong> Everything on this page is synthetic and generated in your browser. It is not from the NASA dataset and not a prediction from the RUL model. <Link to="/analyze" className="font-medium underline underline-offset-2">Analyze your own file</Link> to see real model output.</p>
              </Alert>
            ) : (
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="sky">Your file</Badge> {result.filename} · {fmt(result.rows)} rows · {fmt(result.engines)} engines · model: {result.model.estimator_class}
              </div>
            )}
            {result.warnings.length > 0 && (
              <Alert variant="warning"><Info aria-hidden /><ul className="space-y-1">{result.warnings.map((w) => <li key={w}>{w}</li>)}</ul></Alert>
            )}

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Metric label="Engines" value={fmt(result.engines)} hint={`${fmt(result.rows)} sensor rows`} icon={Plane} />
              <Metric label="Act now" value={fmt(result.status_counts.critical)} hint={`RUL ≤ ${result.thresholds.critical} cycles`} icon={BellRing} />
              <Metric label="Watch" value={fmt(result.status_counts.warning)} hint={`RUL ≤ ${result.thresholds.warning} cycles`} icon={Activity} />
              <Metric label="Shortest RUL" value={shortest ? fmt(shortest.predicted_rul, 0) : '–'} hint={shortest ? `Engine ${shortest.unit}, in cycles` : undefined} icon={Gauge} />
            </div>

            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
              <div>
                <h2 className="mb-3 font-display text-[15px] font-medium">Engines, most urgent first</h2>
                <FleetTable units={result.units} selected={current.unit} onSelect={setSelected} />
                {result.engines > result.detail_limit && (
                  <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground"><ArrowRight className="mt-0.5 size-3.5 shrink-0" aria-hidden />Detailed charts are available for the {result.detail_limit} most urgent engines.</p>
                )}
              </div>
              <Detail key={current.unit} unit={current} result={result} source={source} />
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
