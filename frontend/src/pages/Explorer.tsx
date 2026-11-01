import { useCallback, useEffect, useState } from 'react'
import { useMotionValue, useReducedMotion } from 'framer-motion'
import { Box, Eye, RotateCcw, Rotate3d } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { EngineViewer } from '@/components/engine/EngineViewer'
import { PART_DEFS, type PartInfo } from '@/components/engine/parts'
import { cn, fmt } from '@/lib/utils'

export default function Explorer() {
  const reduce = !!useReducedMotion()
  const explode = useMotionValue(0)
  const [amount, setAmount] = useState(0)
  const [parts, setParts] = useState<PartInfo[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [isolate, setIsolate] = useState(false)
  const [spin, setSpin] = useState(false)
  const [reset, setReset] = useState(0)

  const onParts = useCallback((p: PartInfo[]) => setParts(p), [])
  useEffect(() => { document.title = '3D explorer · AeroGuard AI' }, [])

  const order = Object.keys(PART_DEFS)
  const list = [...parts].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
  const current = list.find((p) => p.key === selected) ?? null
  const totalTris = list.reduce((n, p) => n + p.triangles, 0)

  const setExplode = (v: number) => { setAmount(v); explode.set(v) }

  return (
    <main id="main" className="studio-bg min-h-svh pb-16 pt-24">
      <div className="container-x">
        <header className="max-w-2xl">
          <h1 className="text-3xl font-normal md:text-5xl">3D engine explorer</h1>
          <p className="mt-3 text-muted-foreground">
            Drag to rotate and scroll or pinch to zoom. Click a part to select it, pull the engine apart with the slider, or isolate one part to look at it alone.
          </p>
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_22rem]">
          <div className="surface relative overflow-hidden bg-white/40">
            <EngineViewer
              variant="explorer"
              explode={explode}
              selected={selected}
              hovered={hovered}
              isolate={isolate}
              autoRotate={spin}
              resetSignal={reset}
              reducedMotion={reduce}
              onHover={setHovered}
              onSelect={setSelected}
              onParts={onParts}
              label="Interactive 3D model of the turbofan engine. Use the part list and controls beside it for a keyboard-accessible alternative to dragging."
              className="h-[56svh] min-h-[340px] w-full lg:h-[68svh]"
            />
            {current && (
              <div className="glass pointer-events-none absolute left-4 top-4 rounded-full px-4 py-1.5 text-sm font-medium" aria-hidden>
                {current.label}
              </div>
            )}
          </div>

          <aside className="space-y-5" aria-label="Viewer controls and part list">
            <section className="surface space-y-5 p-5" aria-labelledby="ctl">
              <h2 id="ctl" className="font-display text-[15px] font-medium">View</h2>

              <div>
                <div className="flex items-center justify-between text-sm">
                  <label htmlFor="explode" className="font-medium">Exploded view</label>
                  <span className="tabular text-muted-foreground">{Math.round(amount * 100)}%</span>
                </div>
                <Slider id="explode" className="mt-2" min={0} max={1} step={0.01} value={[amount]} onValueChange={([v]) => setExplode(v)} aria-label="Exploded view amount" />
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setExplode(0)}>Assemble</Button>
                  <Button size="sm" variant="secondary" onClick={() => setExplode(1)}>Take apart</Button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <label htmlFor="isolate" className="text-sm">
                  <span className="font-medium">Isolate selected part</span>
                  <span className="block text-muted-foreground">Hides every other part.</span>
                </label>
                <Switch id="isolate" checked={isolate} onCheckedChange={setIsolate} disabled={!selected} />
              </div>

              <div className="flex items-center justify-between gap-4">
                <label htmlFor="spin" className="text-sm font-medium">Slow auto-rotate</label>
                <Switch id="spin" checked={spin} onCheckedChange={setSpin} />
              </div>

              <Button variant="secondary" size="sm" onClick={() => { setReset((r) => r + 1); setSelected(null); setIsolate(false); setExplode(0) }}>
                <RotateCcw /> Reset view
              </Button>
            </section>

            <section className="surface p-5" aria-labelledby="parts">
              <div className="flex items-baseline justify-between">
                <h2 id="parts" className="font-display text-[15px] font-medium">Parts in the model</h2>
                <span className="text-xs text-muted-foreground">{list.length || '…'} meshes</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">Names come from the mesh names in your .blend file, listed rear to front.</p>
              <ul className="mt-3 space-y-1">
                {list.map((p) => (
                  <li key={p.key}>
                    <button
                      type="button"
                      aria-pressed={selected === p.key}
                      onClick={() => setSelected(selected === p.key ? null : p.key)}
                      onMouseEnter={() => setHovered(p.key)}
                      onMouseLeave={() => setHovered(null)}
                      onFocus={() => setHovered(p.key)}
                      onBlur={() => setHovered(null)}
                      className={cn('flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors', selected === p.key ? 'bg-accent font-medium text-accent-foreground' : 'hover:bg-black/5')}
                    >
                      <span className="flex items-center gap-2"><Box className="size-4 text-muted-foreground" aria-hidden />{p.label}</span>
                      <span className="tabular text-xs text-muted-foreground">{fmt(p.triangles)} tris</span>
                    </button>
                  </li>
                ))}
                {!list.length && <li className="px-3 py-2 text-sm text-muted-foreground" role="status">Loading the model…</li>}
              </ul>
              {list.length > 0 && <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">{fmt(totalTris)} triangles in total, after the web optimisation of the original model.</p>}
            </section>

            <section className="surface p-5" aria-live="polite" aria-labelledby="sel">
              <h2 id="sel" className="flex items-center gap-2 font-display text-[15px] font-medium"><Eye className="size-4" aria-hidden /> Selected part</h2>
              {current ? (
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                  <dt className="text-muted-foreground">Name</dt><dd>{current.label}</dd>
                  <dt className="text-muted-foreground">Vertices</dt><dd className="tabular">{fmt(current.vertices)}</dd>
                  <dt className="text-muted-foreground">Triangles</dt><dd className="tabular">{fmt(current.triangles)}</dd>
                  <dt className="text-muted-foreground">Materials</dt><dd>{current.materials.length ? current.materials.join(', ') : 'unnamed'}</dd>
                </dl>
              ) : (
                <p className="mt-2 flex items-start gap-2 text-sm text-muted-foreground"><Rotate3d className="mt-0.5 size-4 shrink-0" aria-hidden /> Nothing selected. Click a part in the 3D view or in the list.</p>
              )}
              <p className="mt-3 text-xs text-muted-foreground">These are measurements of the 3D mesh. They say nothing about the part's engineering function.</p>
            </section>
          </aside>
        </div>
      </div>
    </main>
  )
}
