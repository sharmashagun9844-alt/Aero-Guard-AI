import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { ArrowRight, BellRing, Boxes, ChevronDown, Gauge, LineChart, ShieldCheck, Upload, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EngineViewer } from '@/components/engine/EngineViewer'
import { PART_DEFS } from '@/components/engine/parts'

function Hero() {
  const explode = useMotionValue(0)
  const reduce = !!useReducedMotion()
  return (
    <section className="studio-bg relative isolate flex min-h-[100svh] flex-col overflow-hidden">
      <div className="container-x relative z-10 pt-32 lg:pt-0 lg:flex lg:min-h-[100svh] lg:items-center">
        <div className="max-w-xl">
          <motion.h1
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="text-[clamp(2.5rem,5.6vw,4.6rem)] font-light leading-[1.04] tracking-[-0.035em]"
          >
            Know how much life an engine has left.
          </motion.h1>
          <motion.p
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 max-w-md text-lg text-muted-foreground"
          >
            AeroGuard AI estimates the remaining useful life of turbofan engines from their sensor data, so maintenance can be planned instead of forced.
          </motion.p>
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="mt-9 flex flex-wrap gap-3"
          >
            <Button asChild variant="primary" size="lg"><Link to="/explorer">Explore the engine <ArrowRight /></Link></Button>
            <Button asChild variant="secondary" size="lg"><Link to="/dashboard">Open dashboard</Link></Button>
          </motion.div>
        </div>
      </div>

      <EngineViewer
        variant="hero"
        explode={explode}
        reducedMotion={reduce}
        label="Interactive 3D render of a turbofan aircraft engine, slowly turning in a studio."
        className="relative z-0 mt-6 h-[64vw] min-h-[300px] w-full lg:absolute lg:inset-y-0 lg:right-[-3%] lg:left-[28%] lg:mt-0 lg:h-auto"
      />

      <a href="#anatomy" className="absolute bottom-6 left-1/2 z-10 hidden -translate-x-1/2 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground lg:flex">
        Scroll to take it apart <ChevronDown className="size-4" />
      </a>
    </section>
  )
}

const STAGES = [
  { title: 'Nine parts, one engine.', body: 'Scroll and it comes apart along its own axis.' },
  { title: 'Rear to front, in order.', body: 'The hull slides back. The canister, grid, mount and pipes move forward. The blades stay put as the spine.' },
  { title: 'Every part is its own mesh.', body: 'Open the explorer to pick any part, isolate it and see how it is built.' },
] as const

function Anatomy() {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = !!useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  const scrolled = useTransform(scrollYProgress, [0.1, 0.78], [0, 1], { clamp: true })
  const manual = useMotionValue(0)
  const explode = reduce ? manual : scrolled
  const [stage, setStage] = useState(0)
  const [manualOn, setManualOn] = useState(false)

  useMotionValueEvent(explode, 'change', (v) => setStage(v < 0.12 ? 0 : v < 0.85 ? 1 : 2))
  useEffect(() => { if (reduce) { manual.set(manualOn ? 1 : 0) } }, [manualOn, reduce, manual])

  return (
    <section id="anatomy" ref={ref} className={reduce ? 'relative' : 'relative h-[280vh]'} aria-label="Engine anatomy">
      <div className={reduce ? 'studio-bg relative h-[88svh] overflow-hidden' : 'studio-bg sticky top-0 h-[100svh] overflow-hidden'}>
        <EngineViewer variant="anatomy" explode={explode} reducedMotion={reduce} label="3D render of the engine separating into its nine parts as you scroll." className="absolute inset-0" showLoading={false} />

        <div className="container-x pointer-events-none relative z-10 flex h-full items-end pb-10 lg:items-center lg:pb-0">
          <div className="pointer-events-auto glass max-w-sm rounded-3xl p-6 lg:max-w-md lg:p-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={stage}
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: 0.28 }}
              >
                <h2 className="text-2xl font-normal lg:text-3xl">{STAGES[stage].title}</h2>
                <p className="mt-3 text-muted-foreground">{STAGES[stage].body}</p>
              </motion.div>
            </AnimatePresence>
            {stage === 2 || reduce ? (
              <div className="mt-5 flex flex-wrap gap-2">
                <Button asChild variant="primary" size="sm"><Link to="/explorer">Open the explorer <ArrowRight /></Link></Button>
                {reduce && <Button variant="secondary" size="sm" onClick={() => setManualOn((o) => !o)}>{manualOn ? 'Assemble' : 'Take apart'}</Button>}
              </div>
            ) : null}
            <p className="mt-5 text-sm text-muted-foreground" aria-label="Part names">
              {Object.values(PART_DEFS).map((p) => p.label).join(', ')}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

const STEPS = [
  { icon: Upload, title: 'Upload sensor data', text: 'A CSV, or the original NASA C-MAPSS text files, up to 20 MB.' },
  { icon: ShieldCheck, title: 'Check the columns', text: 'Every column the model needs must be present and numeric before anything runs.' },
  { icon: Gauge, title: 'Estimate remaining life', text: 'The trained model scores each engine and returns its remaining useful life in cycles.' },
  { icon: Wrench, title: 'Plan maintenance', text: 'Engines are ranked by urgency, with sensor trends and alerts beside each one.' },
]

function Workflow() {
  return (
    <section className="bg-white py-24" aria-labelledby="how">
      <div className="container-x">
        <h2 id="how" className="max-w-xl text-3xl font-normal md:text-4xl">From a file of readings to a maintenance decision.</h2>
        <ol className="mt-14 grid gap-10 md:grid-cols-4 md:gap-6">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative md:pr-4">
              <div className="flex items-center gap-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent text-accent-foreground"><s.icon className="size-5" aria-hidden /></span>
                <span aria-hidden className="hidden h-px flex-1 bg-border md:block last:hidden" style={{ display: i === STEPS.length - 1 ? 'none' : undefined }} />
              </div>
              <h3 className="mt-5 text-lg font-medium"><span className="sr-only">Step {i + 1}: </span>{s.title}</h3>
              <p className="mt-2 text-[15px] text-muted-foreground">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

const FEATURES = [
  { icon: Gauge, title: 'Remaining life per engine', text: 'One number in cycles for every engine in the file, ranked from most to least urgent.' },
  { icon: LineChart, title: 'Sensor trends you can read', text: 'Each sensor gets its own chart on its own scale, so a small drift is not hidden by a large one.' },
  { icon: BellRing, title: 'Alerts that name their source', text: 'Threshold alerts come from the prediction. Sensor drift alerts come from a simple rule. The two are labelled so you can tell them apart.' },
  { icon: Boxes, title: 'A 3D engine you can take apart', text: 'Rotate, zoom, pull the engine into its nine parts and isolate any one of them.' },
]

function Features() {
  return (
    <section className="bg-background py-24" aria-labelledby="features">
      <div className="container-x">
        <h2 id="features" className="max-w-xl text-3xl font-normal md:text-4xl">Built to be checked, not just trusted.</h2>
        <div className="mt-12 grid gap-x-12 gap-y-10 md:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex gap-5 border-t border-border pt-6">
              <f.icon className="mt-1 size-5 shrink-0 text-primary" aria-hidden />
              <div>
                <h3 className="text-lg font-medium">{f.title}</h3>
                <p className="mt-2 max-w-md text-[15px] text-muted-foreground">{f.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Closing() {
  return (
    <section className="studio-bg py-24">
      <div className="container-x flex flex-col items-start gap-8 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl">
          <h2 className="text-3xl font-normal md:text-4xl">Try it with your own sensor data.</h2>
          <p className="mt-4 text-muted-foreground">Upload a file, get a prediction for each engine, and read exactly what the model was and was not given.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="primary" size="lg"><Link to="/analyze">Analyze a file <ArrowRight /></Link></Button>
          <Button asChild variant="secondary" size="lg"><Link to="/about">About the model</Link></Button>
        </div>
      </div>
    </section>
  )
}

export default function Landing() {
  return (
    <main id="main">
      <Hero />
      <Anatomy />
      <Workflow />
      <Features />
      <Closing />
    </main>
  )
}
