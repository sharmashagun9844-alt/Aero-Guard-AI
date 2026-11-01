import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { ScrollToTop } from '@/components/layout/ScrollToTop'
import Landing from '@/pages/Landing'

// Secondary routes load on demand so the landing page stays light.
const Explorer = lazy(() => import('@/pages/Explorer'))
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Analyze = lazy(() => import('@/pages/Analyze'))
const About = lazy(() => import('@/pages/About'))
const NotFound = lazy(() => import('@/pages/NotFound'))

function PageFallback() {
  return (
    <div className="grid min-h-[60svh] place-items-center" role="status">
      <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Loading
      </span>
    </div>
  )
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Navbar />
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/explorer" element={<Explorer />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/analyze" element={<Analyze />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <Footer />
    </>
  )
}
