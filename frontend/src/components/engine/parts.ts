export const MODEL_URL = '/models/engine.glb'
export const POSTER_URL = '/models/engine-poster.webp'

export interface PartDef {
  /** Display name. Taken directly from the mesh names in the supplied .blend file; no function is implied. */
  label: string
  /** Exploded-view travel in model units (the engine is ~4.1 units long along X). */
  offset: [number, number, number]
}

/** Mesh names in the file look like "hull_turbine.004"; three.js strips the dot, so match on the prefix. */
export const PART_DEFS: Record<string, PartDef> = {
  // Ordered rear (-X) to front (+X). The blades mesh holds the fan and turbine rotors and stays put as the spine.
  hull: { label: 'Hull', offset: [-2.5, 0, 0] },
  'blades-dividers': { label: 'Blade dividers', offset: [-1.75, 0, 0] },
  screws: { label: 'Screws', offset: [-1.05, 0, 0] },
  plates: { label: 'Plates', offset: [-0.6, 0, 0] },
  blades: { label: 'Blades', offset: [0, 0, 0] },
  canister: { label: 'Canister', offset: [0.75, 0, 0] },
  grid: { label: 'Grid', offset: [1.45, 0, 0] },
  mount: { label: 'Mount', offset: [2.15, 0, 0] },
  pipes: { label: 'Pipes', offset: [2.95, 0, 0] },
}

export const partKey = (nodeName: string) => nodeName.split('_turbine')[0]

export interface PartInfo {
  key: string
  label: string
  vertices: number
  triangles: number
  materials: string[]
}
