/** Sensor names from the NASA C-MAPSS documentation (Saxena & Goebel, 2008). */
export const SENSOR_META: Record<string, { symbol: string; label: string }> = {
  s1: { symbol: 'T2', label: 'Total temperature at fan inlet' },
  s2: { symbol: 'T24', label: 'Total temperature at LPC outlet' },
  s3: { symbol: 'T30', label: 'Total temperature at HPC outlet' },
  s4: { symbol: 'T50', label: 'Total temperature at LPT outlet' },
  s5: { symbol: 'P2', label: 'Pressure at fan inlet' },
  s6: { symbol: 'P15', label: 'Total pressure in bypass duct' },
  s7: { symbol: 'P30', label: 'Total pressure at HPC outlet' },
  s8: { symbol: 'Nf', label: 'Physical fan speed' },
  s9: { symbol: 'Nc', label: 'Physical core speed' },
  s10: { symbol: 'epr', label: 'Engine pressure ratio' },
  s11: { symbol: 'Ps30', label: 'Static pressure at HPC outlet' },
  s12: { symbol: 'phi', label: 'Ratio of fuel flow to Ps30' },
  s13: { symbol: 'NRf', label: 'Corrected fan speed' },
  s14: { symbol: 'NRc', label: 'Corrected core speed' },
  s15: { symbol: 'BPR', label: 'Bypass ratio' },
  s16: { symbol: 'farB', label: 'Burner fuel-air ratio' },
  s17: { symbol: 'htBleed', label: 'Bleed enthalpy' },
  s18: { symbol: 'Nf_dmd', label: 'Demanded fan speed' },
  s19: { symbol: 'PCNfR_dmd', label: 'Demanded corrected fan speed' },
  s20: { symbol: 'W31', label: 'HPT coolant bleed' },
  s21: { symbol: 'W32', label: 'LPT coolant bleed' },
}

/** Fixed series colours, assigned in order. Chosen to stay distinguishable for common colour-vision types;
 *  lines also differ by dash pattern so identity never depends on colour alone. */
export const SERIES_COLORS = ['#0a6bd6', '#d9822b', '#5b6b8c', '#1c9a8a'] as const
export const SERIES_DASH = ['0', '6 4', '2 3', '10 3 2 3'] as const

export const STATUS_LABEL = { healthy: 'Healthy', warning: 'Watch', critical: 'Act now' } as const
