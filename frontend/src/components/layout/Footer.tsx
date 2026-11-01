import { Link } from 'react-router-dom'
import { LogoMark } from './Logo'

export function Footer() {
  return (
    <footer className="border-t border-border bg-white/60">
      <div className="container-x grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="max-w-sm">
          <div className="flex items-center gap-2.5">
            <LogoMark />
            <span className="font-display text-[15px] font-semibold">AeroGuard AI</span>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Predictive-maintenance analytics for turbofan engines, built on the NASA C-MAPSS simulation dataset. It is a software project, not a certified maintenance tool.
          </p>
        </div>
        <nav aria-label="Product">
          <p className="font-display text-sm font-medium">Product</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link className="hover:text-foreground" to="/explorer">3D explorer</Link></li>
            <li><Link className="hover:text-foreground" to="/dashboard">Dashboard</Link></li>
            <li><Link className="hover:text-foreground" to="/analyze">Analyze sensor data</Link></li>
          </ul>
        </nav>
        <nav aria-label="Learn more">
          <p className="font-display text-sm font-medium">Learn more</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link className="hover:text-foreground" to="/about">About the model</Link></li>
            <li>
              <a className="hover:text-foreground" href="https://www.nasa.gov/intelligent-systems-division/discovery-and-systems-health/pcoe/pcoe-data-set-repository/" target="_blank" rel="noreferrer">
                NASA data repository
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  )
}
