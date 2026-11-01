import type { Health, ModelInfo, PredictionResult, SchemaInfo } from './types'

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? ''

export class ApiError extends Error {
  status: number
  code: string
  errors: string[]
  constructor(status: number, code: string, message: string, errors: string[] = []) {
    super(message)
    this.status = status
    this.code = code
    this.errors = errors
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, init)
  } catch {
    throw new ApiError(0, 'network', 'Cannot reach the AeroGuard API.', [
      'Start the backend with "uvicorn app.main:app --port 8000" from the backend folder, then try again.',
    ])
  }
  if (!res.ok) {
    let body: any = null
    try { body = await res.json() } catch { /* not JSON */ }
    const d = body?.detail
    if (d && typeof d === 'object' && !Array.isArray(d)) throw new ApiError(res.status, d.code ?? 'error', d.message ?? 'Request failed.', d.errors ?? [])
    if (Array.isArray(d)) throw new ApiError(res.status, 'bad_request', 'The request was not accepted.', d.map((x: any) => x?.msg ?? String(x)))
    throw new ApiError(res.status, 'error', `The server returned an error (${res.status}).`)
  }
  return res.json() as Promise<T>
}

export const getHealth = () => request<Health>('/api/health')
export const getModelInfo = () => request<ModelInfo>('/api/model')
export const getSchema = () => request<SchemaInfo>('/api/schema')
export function predict(file: File) {
  const body = new FormData()
  body.append('file', file)
  return request<PredictionResult>('/api/predict', { method: 'POST', body })
}
