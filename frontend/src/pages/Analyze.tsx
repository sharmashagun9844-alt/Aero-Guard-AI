import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, Download, FileSpreadsheet, FlaskConical, Info, Loader2, OctagonAlert, Upload, X } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ApiError, getSchema, predict } from '@/lib/api'
import { useAnalysis } from '@/lib/analysis-store'
import { makeDemoResult } from '@/lib/demo'
import type { PredictionResult, SchemaInfo } from '@/lib/types'
import { cn, fmt } from '@/lib/utils'

type Phase =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success'; result: PredictionResult }
  | { kind: 'error'; title: string; lines: string[]; hint?: string }

const FALLBACK_EXT = ['.csv', '.txt', '.tsv']
const size = (b: number) => (b < 1024 * 1024 ? `${fmt(b / 1024, 0)} KB` : `${fmt(b / 1024 / 1024, 1)} MB`)

function explain(e: unknown): Phase {
  if (e instanceof ApiError) {
    if (e.code === 'network') return { kind: 'error', title: 'The AeroGuard API is not reachable', lines: e.errors, hint: 'Nothing was uploaded to a model.' }
    if (e.code === 'validation_failed') return { kind: 'error', title: 'The file needs changes before it can be analysed', lines: e.errors, hint: 'Fix the points above and upload the file again.' }
    if (e.code === 'model_not_ready') return { kind: 'error', title: 'Your file is valid, but no model is loaded on the server', lines: e.errors, hint: 'No prediction was made and none is shown. See backend/models/README.md for how to add rul_model.joblib.' }
    if (e.code === 'file_too_large') return { kind: 'error', title: 'The file is too large', lines: [e.message] }
    return { kind: 'error', title: e.message, lines: e.errors }
  }
  return { kind: 'error', title: 'Something went wrong', lines: [e instanceof Error ? e.message : 'Unknown error'] }
}

export default function Analyze() {
  const nav = useNavigate()
  const { setAnalysis } = useAnalysis()
  const [schema, setSchema] = useState<SchemaInfo | null>(null)
  const [schemaFailed, setSchemaFailed] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [clientError, setClientError] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [drag, setDrag] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const summary = useRef<HTMLDivElement>(null)

  useEffect(() => { document.title = 'Analyze · AeroGuard AI' }, [])
  useEffect(() => { getSchema().then(setSchema).catch(() => setSchemaFailed(true)) }, [])
  // Move focus to the result so keyboard and screen-reader users land on it.
  useEffect(() => { if (phase.kind === 'error' || phase.kind === 'success') summary.current?.focus() }, [phase])

  const exts = schema?.accepted_extensions ?? FALLBACK_EXT
  const maxMb = schema?.max_upload_mb ?? 20

  const choose = useCallback((f: File | undefined | null) => {
    setPhase({ kind: 'idle' })
    if (!f) return
    const ok = exts.some((x) => f.name.toLowerCase().endsWith(x))
    if (!ok) { setFile(null); setClientError(`"${f.name}" is not a supported file type. Use ${exts.join(', ')}.`); return }
    if (f.size === 0) { setFile(null); setClientError(`"${f.name}" is empty.`); return }
    if (f.size > maxMb * 1024 * 1024) { setFile(null); setClientError(`"${f.name}" is ${size(f.size)}; the limit is ${maxMb} MB.`); return }
    setClientError(null)
    setFile(f)
  }, [exts, maxMb])

  const onDrop = (e: DragEvent) => { e.preventDefault(); setDrag(false); choose(e.dataTransfer.files?.[0]) }

  async function run() {
    if (!file) return
    setPhase({ kind: 'loading' })
    try {
      const result = await predict(file)
      setAnalysis(result, 'upload')
      setPhase({ kind: 'success', result })
    } catch (e) {
      setPhase(explain(e))
    }
  }

  function template() {
    const cols = ['unit', 'cycle', ...(schema?.required_columns ?? [])]
    const url = URL.createObjectURL(new Blob([cols.join(',') + '\n'], { type: 'text/csv' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: 'aeroguard-template.csv' })
    a.click()
    URL.revokeObjectURL(url)
  }

  const loading = phase.kind === 'loading'

  return (
    <main id="main" className="studio-bg min-h-svh pb-20 pt-24">
      <div className="container-x">
        <header className="max-w-2xl">
          <h1 className="text-3xl font-normal md:text-5xl">Analyze sensor data</h1>
          <p className="mt-3 text-muted-foreground">Upload engine sensor readings and the trained model returns the remaining useful life for each engine. Your file is checked before anything is scored.</p>
        </header>

        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[1fr_24rem]">
          <div className="space-y-5">
            <div
              onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
              onDragLeave={() => setDrag(false)}
              onDrop={onDrop}
              className={cn('surface border-2 border-dashed p-8 text-center transition-colors md:p-12', drag ? 'border-primary bg-accent/60' : 'border-input')}
            >
              <input ref={input} id="file" type="file" accept={exts.join(',')} className="sr-only" onChange={(e) => { choose(e.target.files?.[0]); e.target.value = '' }} />
              <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent text-accent-foreground"><Upload className="size-6" aria-hidden /></span>
              <h2 className="mt-4 text-xl font-normal">Drop a file here</h2>
              <p className="mt-1 text-sm text-muted-foreground">{exts.join(', ')} · up to {maxMb} MB</p>
              <Button variant="secondary" className="mt-5" onClick={() => input.current?.click()} disabled={loading}>Choose a file</Button>
            </div>

            <div aria-live="polite">
              {clientError && (
                <Alert variant="error"><OctagonAlert aria-hidden /><p>{clientError}</p></Alert>
              )}
            </div>

            {file && (
              <div className="surface flex flex-wrap items-center gap-4 p-4">
                <FileSpreadsheet className="size-5 text-primary" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">{size(file.size)}</p>
                </div>
                <Button variant="ghost" size="icon" aria-label="Remove file" onClick={() => { setFile(null); setPhase({ kind: 'idle' }) }} disabled={loading}><X /></Button>
                <Button variant="primary" onClick={run} disabled={loading}>
                  {loading ? <><Loader2 className="animate-spin" /> Analysing…</> : 'Analyze file'}
                </Button>
              </div>
            )}

            <div ref={summary} tabIndex={-1} className="outline-none" aria-live="polite">
              {loading && <p className="sr-only" role="status">Analysing your file</p>}

              {phase.kind === 'error' && (
                <div role="alert" className="rounded-xl border border-[#efc0b9] bg-[#fdeceb] p-5 text-[#8a2418]">
                  <h2 className="flex items-center gap-2 font-display text-base font-medium"><OctagonAlert className="size-4" aria-hidden />{phase.title}</h2>
                  {phase.lines.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">{phase.lines.map((l) => <li key={l}>{l}</li>)}</ul>}
                  {phase.hint && <p className="mt-3 text-sm">{phase.hint}</p>}
                </div>
              )}

              {phase.kind === 'success' && (
                <div className="surface p-6">
                  <h2 className="flex items-center gap-2 font-display text-lg font-medium"><CheckCircle2 className="size-5 text-healthy" aria-hidden /> Analysis complete</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{phase.result.filename} · {fmt(phase.result.rows)} rows · {fmt(phase.result.engines)} engines · scored by {phase.result.model.estimator_class}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge variant="critical">{phase.result.status_counts.critical} act now</Badge>
                    <Badge variant="warning">{phase.result.status_counts.warning} watch</Badge>
                    <Badge variant="healthy">{phase.result.status_counts.healthy} healthy</Badge>
                  </div>
                  {phase.result.warnings.length > 0 && (
                    <Alert variant="warning" className="mt-4"><Info aria-hidden /><ul className="space-y-1">{phase.result.warnings.map((w) => <li key={w}>{w}</li>)}</ul></Alert>
                  )}
                  <Button variant="primary" className="mt-5" onClick={() => nav('/dashboard')}>Open dashboard</Button>
                </div>
              )}
            </div>

            {phase.kind === 'idle' && !file && !clientError && (
              <p className="text-sm text-muted-foreground">No file selected yet. Nothing is uploaded until you press Analyze.</p>
            )}
          </div>

          <aside className="space-y-5" aria-label="File requirements">
            <section className="surface p-5" aria-labelledby="req">
              <h2 id="req" className="font-display text-[15px] font-medium">What the file needs</h2>
              {schemaFailed && <Alert variant="warning" className="mt-3"><Info aria-hidden /><p>The API is not reachable, so the exact requirements cannot be loaded. The general format is below.</p></Alert>}
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>One row per engine per cycle, with a <code>unit</code> and a <code>cycle</code> column.</li>
                <li>Every sensor column the model expects, all numeric, none empty.</li>
                <li>A header row, or the original headerless NASA C-MAPSS text layout of 26 columns.</li>
              </ul>
              {schema ? (
                <details className="mt-4 text-sm">
                  <summary className="cursor-pointer font-medium">Required columns ({schema.required_columns.length})</summary>
                  <p className="mt-2 text-xs text-muted-foreground">Source: {schema.required_source}</p>
                  <p className="mt-2 flex flex-wrap gap-1.5">{schema.required_columns.map((c) => <code key={c} className="rounded-md bg-black/[0.05] px-1.5 py-0.5 text-xs">{c}</code>)}</p>
                </details>
              ) : !schemaFailed && <p className="mt-4 text-sm text-muted-foreground" role="status">Loading requirements…</p>}
              <Button variant="secondary" size="sm" className="mt-4" onClick={template} disabled={!schema}><Download /> Download header template</Button>
            </section>

            <section className="surface p-5" aria-labelledby="demo">
              <h2 id="demo" className="font-display text-[15px] font-medium">Just looking around?</h2>
              <p className="mt-1 text-sm text-muted-foreground">Preview the dashboard with synthetic data. It is labelled as a demonstration everywhere it appears and is not a model prediction.</p>
              <Button variant="secondary" size="sm" className="mt-3" onClick={() => { setAnalysis(makeDemoResult(), 'demo'); nav('/dashboard') }}><FlaskConical /> Preview with demo data</Button>
            </section>

            <p className="px-1 text-xs text-muted-foreground">Files go only to the AeroGuard API you are running, which does not save them. The browser keeps just the result, for this tab. <Link to="/about" className="underline underline-offset-2">About the model</Link></p>
          </aside>
        </div>
      </div>
    </main>
  )
}
