import { useEffect, useState } from 'react'
import { getHealth } from '@/lib/api'
import type { Health } from '@/lib/types'

export type ApiState =
  | { kind: 'checking' }
  | { kind: 'offline' }
  | { kind: 'no-model'; health: Health }
  | { kind: 'ready'; health: Health }

export function useApiStatus(): ApiState {
  const [state, setState] = useState<ApiState>({ kind: 'checking' })
  useEffect(() => {
    let alive = true
    getHealth()
      .then((h) => alive && setState(h.model_ready ? { kind: 'ready', health: h } : { kind: 'no-model', health: h }))
      .catch(() => alive && setState({ kind: 'offline' }))
    return () => { alive = false }
  }, [])
  return state
}
