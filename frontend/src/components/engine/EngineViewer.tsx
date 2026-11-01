import { Component, lazy, Suspense, useCallback, useMemo, useState, type ReactNode } from 'react'
import { ImageOff, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useInView } from '@/hooks/use-in-view'
import { POSTER_URL } from './parts'
import type { EngineSceneProps } from './EngineScene'

// Three.js and drei live in their own chunk so the rest of the site loads first.
const EngineScene = lazy(() => import('./EngineScene'))

class Boundary extends Component<{ onError: (e: Error) => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(e: Error) { this.props.onError(e) }
  render() { return this.state.failed ? null : this.props.children }
}

function webglAvailable() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch { return false }
}

interface Props extends Omit<EngineSceneProps, 'paused' | 'onReady'> {
  className?: string
  label: string
  /** Show the "Loading 3D model" chip while the GLB downloads. */
  showLoading?: boolean
}

export function EngineViewer({ className, label, showLoading = true, ...scene }: Props) {
  const [ref, inView] = useInView<HTMLDivElement>()
  const [ready, setReady] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [posterOk, setPosterOk] = useState(true)
  const supported = useMemo(webglAvailable, [])
  const onReady = useCallback(() => setReady(true), [])
  const broken = !supported || failure

  return (
    <div ref={ref} className={cn('relative', className)} role="img" aria-label={label} aria-busy={!ready && !broken}>
      {posterOk && (
        <img
          src={POSTER_URL}
          alt=""
          onError={() => setPosterOk(false)}
          className={cn('pointer-events-none absolute inset-0 size-full object-contain transition-opacity duration-700', ready && !broken ? 'opacity-0' : 'opacity-100')}
          draggable={false}
        />
      )}

      {!broken && (
        <Boundary onError={(e) => setFailure(e.message || 'The 3D model could not be loaded.')}>
          <Suspense fallback={null}>
            <div className={cn('absolute inset-0 transition-opacity duration-700', ready ? 'opacity-100' : 'opacity-0')}>
              <EngineScene {...scene} paused={!inView} onReady={onReady} />
            </div>
          </Suspense>
        </Boundary>
      )}

      {!ready && !broken && showLoading && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center" role="status">
          <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Loading 3D model
          </span>
        </div>
      )}

      {broken && (
        <div className="absolute inset-x-4 bottom-4 flex justify-center" role="alert">
          <div className="glass flex max-w-md items-start gap-3 rounded-2xl p-4 text-sm">
            <ImageOff className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <div>
              <p className="font-medium">The 3D view is not available</p>
              <p className="text-muted-foreground">
                {!supported ? 'This browser or device has WebGL turned off.' : 'The engine model could not be loaded.'}{' '}
                {posterOk ? 'A still render is shown instead.' : 'Try reloading the page or a different browser.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
