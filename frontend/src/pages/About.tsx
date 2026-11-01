import { Fragment, useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, Info, Loader2, OctagonAlert } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { ApiError, getModelInfo } from '@/lib/api'
import type { ModelInfo } from '@/lib/types'
import { fmt } from '@/lib/utils'

const NASA_URL = 'https://data.nasa.gov/dataset/cmapss-jet-engine-simulated-data'

const SUBSETS = [
  { id: 'FD001', train: 100, test: 100, cond: 'One (sea level)', fault: 'HPC degradation' },
  { id: 'FD002', train: 260, test: 259, cond: 'Six', fault: 'HPC degradation' },
  { id: 'FD003', train: 100, test: 100, cond: 'One (sea level)', fault: 'HPC and fan degradation' },
  { id: 'FD004', train: 248, test: 249, cond: 'Six', fault: 'HPC and fan degradation' },
]

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="border-t border-border py-12 first:border-0 first:pt-0">
      <h2 id={id} className="text-2xl font-normal md:text-3xl">{title}</h2>
      <div className="mt-5 space-y-4 text-[15px] leading-relaxed text-muted-foreground">{children}</div>
    </section>
  )
}

function ModelFacts() {
  const [info, setInfo] = useState<ModelInfo | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => { getModelInfo().then(setInfo).catch((e) => setErr(e instanceof ApiError ? e.message : 'Could not load model information.')) }, [])

  if (err) return <Alert variant="warning"><Info aria-hidden /><p>{err} Start the backend to see which model is installed. Nothing is assumed in the meantime.</p></Alert>
  if (!info) return <p className="inline-flex items-center gap-2 text-sm" role="status"><Loader2 className="size-4 animate-spin" aria-hidden /> Reading model details from the API…</p>

  if (!info.ready) {
    return (
      <Alert variant="error">
        <OctagonAlert aria-hidden />
        <div>
          <p className="font-medium">No model is loaded on the server.</p>
          <p className="mt-1">{info.error ?? 'The model file could not be used.'}</p>
          <p className="mt-1">Until <code>{info.file_name}</code> is installed, AeroGuard cannot make predictions and reports no accuracy figures.</p>
        </div>
      </Alert>
    )
  }

  const rows: [string, ReactNode][] = [
    ['File', `${info.file_name}${info.file_size_bytes != null ? ` (${fmt(info.file_size_bytes / 1024, 0)} KB)` : ''}`],
    ['Estimator class', info.estimator_class ?? 'unknown'],
    ['Input features', `${info.n_features ?? '?'} (names from ${info.feature_source ?? 'unknown'})`],
    ['Separate scaler', info.has_scaler ? 'Yes' : 'No'],
    ['Loaded', info.loaded_at ?? 'unknown'],
  ]
  const declared = Object.entries(info.declared)
  return (
    <div className="space-y-4">
      <dl className="surface grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 p-5 text-sm">
        {rows.map(([k, v]) => (<Fragment key={k}><dt className="text-muted-foreground">{k}</dt><dd className="text-foreground">{v}</dd></Fragment>))}
      </dl>
      {info.warnings.length > 0 && <Alert variant="warning"><Info aria-hidden /><ul className="space-y-1">{info.warnings.map((w) => <li key={w}>{w}</li>)}</ul></Alert>}
      {declared.length > 0 ? (
        <div className="surface p-5">
          <p className="font-medium text-foreground">Details written by the model's owner <Badge variant="neutral" className="ml-1">model_meta.json</Badge></p>
          <p className="mt-1 text-xs">Shown exactly as supplied. AeroGuard has not verified these values.</p>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            {declared.map(([k, v]) => (<Fragment key={k}><dt className="text-muted-foreground">{k}</dt><dd className="break-words text-foreground">{typeof v === 'string' ? v : JSON.stringify(v)}</dd></Fragment>))}
          </dl>
        </div>
      ) : (
        <p className="text-sm">No accuracy or training details were supplied with the model, so none are shown.</p>
      )}
    </div>
  )
}

export default function About() {
  useEffect(() => { document.title = 'About the model · AeroGuard AI' }, [])
  return (
    <main id="main" className="studio-bg min-h-svh pb-20 pt-24">
      <div className="container-x max-w-3xl">
        <header>
          <h1 className="text-3xl font-normal md:text-5xl">About AeroGuard AI</h1>
          <p className="mt-4 text-lg text-muted-foreground">A predictive-maintenance project that estimates how many operating cycles a turbofan engine has left, and shows its working.</p>
        </header>

        <div className="mt-12">
          <Section id="what" title="What it does">
            <p>You upload sensor readings for one or more engines. A trained regression model estimates each engine's remaining useful life (RUL), counted in operating cycles. AeroGuard ranks the engines by urgency and draws their sensor trends so a person can judge the result.</p>
            <p>It is a software project built for learning and demonstration. It is not certified, and it must not be used to make real airworthiness or maintenance decisions.</p>
          </Section>

          <Section id="data" title="The NASA C-MAPSS dataset">
            <p>C-MAPSS is a set of simulated run-to-failure records for a fleet of turbofan engines, published by NASA's Prognostics Center of Excellence. Each engine begins in normal operation and develops a fault part-way through. In the training sets the fault grows until the engine fails; in the test sets the record stops some time before failure and the true RUL is supplied separately.</p>
            <p>Each row is one cycle with 26 values: unit number, cycle, three operational settings and 21 sensor channels. The data is simulated, with sensor noise added, so it is not recorded from real aircraft.</p>
            <div className="surface overflow-x-auto">
              <table className="w-full min-w-[34rem] text-left text-sm text-foreground">
                <caption className="sr-only">The four C-MAPSS sub-datasets</caption>
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-border">
                    <th scope="col" className="px-4 py-3 font-medium">Subset</th><th scope="col" className="px-3 py-3 text-right font-medium">Train engines</th><th scope="col" className="px-3 py-3 text-right font-medium">Test engines</th><th scope="col" className="px-3 py-3 font-medium">Conditions</th><th scope="col" className="px-4 py-3 font-medium">Fault modes</th>
                  </tr>
                </thead>
                <tbody>
                  {SUBSETS.map((s) => (
                    <tr key={s.id} className="border-b border-border/60 last:border-0">
                      <th scope="row" className="px-4 py-2.5 font-medium">{s.id}</th>
                      <td className="tabular px-3 text-right">{s.train}</td><td className="tabular px-3 text-right">{s.test}</td><td className="px-3">{s.cond}</td><td className="px-4">{s.fault}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm">
              Source:{' '}
              <a href={NASA_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-2">NASA Open Data Portal <ExternalLink className="size-3.5" aria-hidden /></a>.
              Saxena, Goebel, Simon and Eklund, "Damage Propagation Modeling for Aircraft Engine Run-to-Failure Simulation", PHM08, Denver, 2008. HPC is the high-pressure compressor.
            </p>
          </Section>

          <Section id="approach" title="How the prediction works here">
            <ol className="list-decimal space-y-2 pl-5">
              <li>The file is parsed and every column the model needs is checked to be present and numeric.</li>
              <li>The model scores each row on its own: one row in, one RUL estimate out. It does not look at neighbouring cycles unless that is built into the model file itself.</li>
              <li>An engine's headline RUL is the estimate at its last cycle in the file.</li>
              <li>Status levels come from two AeroGuard thresholds on that number. They are product defaults you can change, not values from NASA or the model.</li>
              <li>Drift alerts compare recent sensor readings with the engine's own early baseline. They are simple rules, are labelled as such, and are not predictions.</li>
            </ol>
          </Section>

          <Section id="model" title="The installed model">
            <p>This is read live from the API, so it describes exactly what is running and nothing else.</p>
            <ModelFacts />
          </Section>

          <Section id="limits" title="Limitations">
            <ul className="list-disc space-y-2 pl-5">
              <li><strong className="font-medium text-foreground">No accuracy claim.</strong> AeroGuard has not measured this model's error, and no figure is shown unless the model's owner supplies one.</li>
              <li><strong className="font-medium text-foreground">Simulated data.</strong> A model that works on C-MAPSS says little about how it would behave on real engines, other fault types or other operating conditions.</li>
              <li><strong className="font-medium text-foreground">Matching inputs.</strong> Results are only meaningful if uploaded columns match what the model was trained on, in meaning, units and preprocessing.</li>
              <li><strong className="font-medium text-foreground">Arbitrary thresholds.</strong> The cut-offs for "Watch" and "Act now" are defaults, and the right values depend on your maintenance policy.</li>
              <li><strong className="font-medium text-foreground">Single estimate.</strong> The model returns one number per row, with no confidence range.</li>
            </ul>
          </Section>

          <div className="flex flex-wrap gap-3 border-t border-border pt-10">
            <Link to="/analyze" className="text-sm font-medium text-primary underline underline-offset-2">Analyze a file</Link>
            <Link to="/explorer" className="text-sm font-medium text-primary underline underline-offset-2">Explore the 3D engine</Link>
          </div>
        </div>
      </div>
    </main>
  )
}
