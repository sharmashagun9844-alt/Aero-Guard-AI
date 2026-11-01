export type Status = 'healthy' | 'warning' | 'critical'

export interface Alert {
  level: 'critical' | 'warning' | 'info'
  /** 'model' = derived from the model's prediction; 'heuristic' = rule-based sensor check. */
  source: 'model' | 'heuristic'
  title: string
  detail: string
  sensor?: string
}

export interface SensorStat {
  sensor: string
  symbol: string
  label: string
  first: number
  last: number
  change_pct: number | null
}

export interface UnitDetail {
  rul_series: { cycle: number; rul: number }[]
  sensor_series: Record<string, number[]>
  sensor_cycles: number[]
  sensor_stats: SensorStat[]
  alerts: Alert[]
}

export interface UnitResult {
  unit: number
  cycles_observed: number
  last_cycle: number
  predicted_rul: number
  status: Status
  detail: UnitDetail | null
}

export interface PredictionResult {
  filename: string
  rows: number
  engines: number
  warnings: string[]
  status_counts: Record<Status, number>
  thresholds: { critical: number; warning: number }
  detail_limit: number
  model: { estimator_class: string; n_features: number; feature_source: string | null }
  units: UnitResult[]
}

export interface Health {
  status: string
  model_ready: boolean
  model_error: string | null
}

export interface ModelInfo {
  file_present: boolean
  file_name: string
  file_size_bytes: number | null
  ready: boolean
  error: string | null
  estimator_class: string | null
  n_features: number | null
  features: string[] | null
  feature_source: string | null
  has_scaler: boolean
  loaded_at: string | null
  warnings: string[]
  declared: Record<string, unknown>
}

export interface SchemaInfo {
  accepted_extensions: string[]
  max_upload_mb: number
  required_columns: string[]
  required_source: string
  identifier_columns: string[]
  cmapss_layout: string[]
  sensors: Record<string, { symbol: string; label: string }>
  thresholds: { critical: number; warning: number; note: string }
}
