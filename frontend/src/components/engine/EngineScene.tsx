import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import type { MotionValue } from 'framer-motion'
import { MODEL_URL, PART_DEFS, partKey, type PartInfo } from './parts'

export type SceneVariant = 'hero' | 'anatomy' | 'explorer'

export interface EngineSceneProps {
  variant: SceneVariant
  /** 0 = assembled, 1 = fully exploded. A MotionValue so scrolling/sliding never re-renders React. */
  explode: MotionValue<number>
  selected?: string | null
  hovered?: string | null
  isolate?: boolean
  autoRotate?: boolean
  resetSignal?: number
  paused?: boolean
  reducedMotion?: boolean
  onHover?: (key: string | null) => void
  onSelect?: (key: string | null) => void
  onParts?: (parts: PartInfo[]) => void
  onReady?: () => void
}

useGLTF.preload(MODEL_URL, false)

/** Pull the camera back on narrow screens so the engine's length always fits. */
const fitFactor = (aspect: number) => Math.max(1, 1.6 / aspect)

const smooth = (x: number) => x * x * (3 - 2 * x)
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

interface Runtime {
  key: string
  node: THREE.Object3D
  base: THREE.Vector3
  offset: THREE.Vector3
  meshes: THREE.Mesh[]
  delay: number
}

function prepare(scene: THREE.Object3D) {
  const root = scene.clone(true)
  // Every mesh gets its own material instance so a single part can be highlighted without touching the others.
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.isMesh) m.material = Array.isArray(m.material) ? m.material.map((x) => x.clone()) : m.material.clone()
  })

  const runtime: Runtime[] = []
  const info: PartInfo[] = []
  for (const node of root.children) {
    const meshes: THREE.Mesh[] = []
    node.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh) })
    if (!meshes.length) continue
    const key = partKey(node.name)
    const def = PART_DEFS[key] ?? { label: node.name, offset: [0, 0, 0] as [number, number, number] }
    let vertices = 0, triangles = 0
    const mats = new Set<string>()
    for (const m of meshes) {
      vertices += m.geometry.attributes.position.count
      triangles += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3
      ;(Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.name && mats.add(x.name))
    }
    runtime.push({ key, node, base: node.position.clone(), offset: new THREE.Vector3(...def.offset), meshes, delay: 0 })
    info.push({ key, label: def.label, vertices, triangles, materials: [...mats] })
  }
  // Stagger: parts travelling the shortest distance move first.
  [...runtime].sort((a, b) => a.offset.length() - b.offset.length()).forEach((p, i, arr) => { p.delay = (i / Math.max(1, arr.length - 1)) * 0.35 })

  root.updateMatrixWorld(true)
  const box0 = new THREE.Box3().setFromObject(root)
  runtime.forEach((p) => p.node.position.copy(p.base).add(p.offset))
  root.updateMatrixWorld(true)
  const box1 = new THREE.Box3().setFromObject(root)
  runtime.forEach((p) => p.node.position.copy(p.base))
  root.updateMatrixWorld(true)

  const c0 = box0.getCenter(new THREE.Vector3())
  const c1 = box1.getCenter(new THREE.Vector3())
  const fit = THREE.MathUtils.clamp((box0.getSize(new THREE.Vector3()).x * 1.45) / box1.getSize(new THREE.Vector3()).x, 0.4, 1)
  return { root, runtime, info, c0, shift: c1.clone().sub(c0), fit }
}

function EngineModel(props: EngineSceneProps) {
  const { explode, selected, hovered, isolate, onHover, onSelect, onParts, onReady, variant } = props
  const { scene } = useGLTF(MODEL_URL, false) as unknown as { scene: THREE.Group }
  const model = useMemo(() => prepare(scene), [scene])
  const wrapper = useRef<THREE.Group>(null)
  const current = useRef(0)
  const applied = useRef(-1)

  useEffect(() => { onParts?.(model.info); onReady?.() }, [model, onParts, onReady])

  // Highlight (hover/selection) via emissive tint on that part's private materials.
  useEffect(() => {
    for (const p of model.runtime) {
      const level = p.key === selected ? 0.55 : p.key === hovered ? 0.3 : 0
      for (const m of p.meshes) {
        for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
          const s = mat as THREE.MeshStandardMaterial
          if (!s.emissive) continue
          s.emissive.set('#2b8cf0')
          s.emissiveIntensity = level
        }
      }
      p.node.visible = !(isolate && selected && p.key !== selected)
    }
  }, [model, selected, hovered, isolate])

  useFrame((_, dt) => {
    const target = explode.get()
    current.current = props.reducedMotion ? target : THREE.MathUtils.damp(current.current, target, 5.5, Math.min(dt, 0.05))
    const e = current.current
    if (Math.abs(e - applied.current) < 1e-4) return
    applied.current = e
    for (const p of model.runtime) {
      const t = smooth(clamp01((e - p.delay) / (1 - p.delay)))
      p.node.position.copy(p.base).addScaledVector(p.offset, t)
    }
    const w = wrapper.current
    if (w) {
      const s = THREE.MathUtils.lerp(1, model.fit, smooth(e))
      w.scale.setScalar(s)
      w.position.copy(model.shift).multiplyScalar(-s * smooth(e))
    }
  })

  const partOf = (obj: THREE.Object3D): string | null => {
    let o: THREE.Object3D | null = obj
    while (o && o.parent !== model.root) o = o.parent
    return o ? partKey(o.name) : null
  }

  return (
    <group ref={wrapper}>
      <group position={model.c0.clone().multiplyScalar(-1)}>
        <primitive
          object={model.root}
          onPointerOver={variant === 'explorer' ? (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; onHover?.(partOf(e.object)) } : undefined}
          onPointerOut={variant === 'explorer' ? () => { document.body.style.cursor = ''; onHover?.(null) } : undefined}
          onClick={variant === 'explorer' ? (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); const k = partOf(e.object); onSelect?.(k === selected ? null : k) } : undefined}
        />
      </group>
    </group>
  )
}

/** Cinematic camera used by the hero and the scroll-driven anatomy section. */
function CameraRig({ variant, explode, reducedMotion }: Pick<EngineSceneProps, 'variant' | 'explode' | 'reducedMotion'>) {
  const { camera, pointer, size } = useThree()
  const st = useRef({ az: 0.7, el: 0.2, dist: 9.4, px: 0, py: 0 })
  useFrame((state, dt) => {
    const t = reducedMotion ? 0 : state.clock.elapsedTime
    const e = explode.get()
    const s = st.current
    let az: number, el: number, dist: number
    if (variant === 'hero') {
      az = 0.78 + 0.12 * Math.sin(t * 0.22) + s.px * 0.12
      el = 0.2 + 0.035 * Math.sin(t * 0.17) + s.py * 0.05
      dist = 9.6 + 0.25 * Math.sin(t * 0.13)
    } else {
      az = 1.0 - 0.9 * e + 0.04 * Math.sin(t * 0.2)
      el = 0.24 - 0.06 * e
      dist = 9.4 + 3.4 * e
    }
    dist *= fitFactor(size.width / size.height)
    const k = reducedMotion ? 1 : 1 - Math.exp(-3 * Math.min(dt, 0.05))
    s.px += ((reducedMotion ? 0 : pointer.x) - s.px) * k
    s.py += ((reducedMotion ? 0 : pointer.y) - s.py) * k
    s.az += (az - s.az) * k; s.el += (el - s.el) * k; s.dist += (dist - s.dist) * k
    camera.position.set(s.dist * Math.sin(s.az) * Math.cos(s.el), s.dist * Math.sin(s.el), s.dist * Math.cos(s.az) * Math.cos(s.el))
    camera.lookAt(0, 0, 0)
  })
  return null
}

const HOME = new THREE.Vector3(5.6, 1.9, 7.2)

function ExplorerControls({ resetSignal, autoRotate }: { resetSignal?: number; autoRotate?: boolean }) {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const ref = useRef<any>(null)
  const f = fitFactor(size.width / size.height)
  useEffect(() => {
    camera.position.copy(HOME).multiplyScalar(f)
    ref.current?.target.set(0, 0, 0)
    ref.current?.update()
  }, [resetSignal, camera, f])
  return (
    <OrbitControls
      ref={ref}
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      minDistance={3.2}
      maxDistance={32}
      rotateSpeed={0.7}
      zoomSpeed={0.7}
      autoRotate={autoRotate}
      autoRotateSpeed={0.8}
    />
  )
}

/** Studio lighting built from soft boxes. Nothing is downloaded, so it works offline. */
function Studio() {
  return (
    <Environment resolution={512} frames={1} environmentIntensity={1}>
      {/* A mid-dark room with large soft boxes: gives metal real light/dark banding instead of a flat wash. */}
      <color attach="background" args={['#3b4452']} />
      <Lightformer form="rect" intensity={5.5} color="#ffffff" position={[0, 6, 1]} rotation-x={Math.PI / 2} scale={[16, 5, 1]} />
      <Lightformer form="rect" intensity={4.2} color="#ffffff" position={[-7, 1.5, 3]} rotation-y={Math.PI / 2} scale={[10, 2.2, 1]} />
      <Lightformer form="rect" intensity={3.4} color="#d6e8ff" position={[7, 2, -3]} rotation-y={-Math.PI / 2} scale={[10, 2.2, 1]} />
      <Lightformer form="rect" intensity={2.6} color="#ffffff" position={[3, 0.5, 8]} scale={[8, 1.4, 1]} />
      <Lightformer form="ring" intensity={2.2} color="#ffffff" position={[0, 2, -8]} scale={6} />
      <Lightformer form="rect" intensity={1.6} color="#e9f1ff" position={[0, -4, 4]} rotation-x={-Math.PI / 2.4} scale={[12, 2, 1]} />
    </Environment>
  )
}

export default function EngineScene(props: EngineSceneProps) {
  const { variant, paused } = props
  return (
    <Canvas
      frameloop={paused ? 'never' : 'always'}
      dpr={[1, 1.75]}
      camera={{ position: HOME.toArray(), fov: 27, near: 0.1, far: 80 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.05
        gl.setClearColor(0x000000, 0)
      }}
      style={{ touchAction: variant === 'explorer' ? 'none' : 'pan-y' }}
      onPointerMissed={() => props.onSelect?.(null)}
    >
      <Studio />
      <hemisphereLight args={['#ffffff', '#8c98a8', 0.18]} />
      <directionalLight position={[4, 6, 5]} intensity={0.6} color="#ffffff" />
      <Suspense fallback={null}>
        <EngineModel {...props} />
        <ContactShadows position={[0, -1.35, 0]} opacity={0.38} scale={16} blur={2.8} far={3.2} resolution={512} color="#1b2430" />
      </Suspense>
      {variant === 'explorer' ? <ExplorerControls resetSignal={props.resetSignal} autoRotate={props.autoRotate && !props.reducedMotion} /> : <CameraRig variant={variant} explode={props.explode} reducedMotion={props.reducedMotion} />}
    </Canvas>
  )
}
