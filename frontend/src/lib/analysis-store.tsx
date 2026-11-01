import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { PredictionResult } from './types'

export type AnalysisSource = 'upload' | 'demo'
interface Stored { result: PredictionResult; source: AnalysisSource }
interface Ctx {
  result: PredictionResult | null
  source: AnalysisSource | null
  setAnalysis: (r: PredictionResult, s: AnalysisSource) => void
  clear: () => void
}

const KEY = 'aeroguard.analysis.v1'
const AnalysisContext = createContext<Ctx | null>(null)

function load(): Stored | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Stored) : null
  } catch { return null }
}

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Stored | null>(load)

  const setAnalysis = useCallback((result: PredictionResult, source: AnalysisSource) => {
    setState({ result, source })
    try { sessionStorage.setItem(KEY, JSON.stringify({ result, source })) } catch { /* storage full or blocked: keep in memory only */ }
  }, [])
  const clear = useCallback(() => {
    setState(null)
    try { sessionStorage.removeItem(KEY) } catch { /* ignore */ }
  }, [])

  const value = useMemo(() => ({ result: state?.result ?? null, source: state?.source ?? null, setAnalysis, clear }), [state, setAnalysis, clear])
  return <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>
}

export function useAnalysis() {
  const c = useContext(AnalysisContext)
  if (!c) throw new Error('useAnalysis must be used inside AnalysisProvider')
  return c
}
