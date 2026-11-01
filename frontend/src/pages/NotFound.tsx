import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <main id="main" className="studio-bg grid min-h-[70svh] place-items-center px-5 pt-24">
      <div className="max-w-md text-center">
        <p className="text-sm font-medium text-primary">404</p>
        <h1 className="mt-2 text-3xl font-normal">That page does not exist.</h1>
        <p className="mt-3 text-muted-foreground">The link may be out of date. Head back to the start.</p>
        <Button asChild variant="primary" className="mt-6"><Link to="/">Back to home</Link></Button>
      </div>
    </main>
  )
}
