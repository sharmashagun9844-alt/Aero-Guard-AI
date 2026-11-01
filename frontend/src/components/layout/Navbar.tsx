import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LogoMark } from './Logo'

const links = [
  { to: '/explorer', label: '3D explorer' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/analyze', label: 'Analyze' },
  { to: '/about', label: 'About' },
]

export function Navbar() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  return (
    <header className="fixed inset-x-0 top-3 z-50 px-3">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:shadow">
        Skip to content
      </a>
      <nav aria-label="Main" className="glass mx-auto flex h-14 max-w-5xl items-center justify-between rounded-full pl-5 pr-2">
        <Link to="/" className="flex items-center gap-2.5 rounded-full" aria-label="AeroGuard AI home">
          <LogoMark />
          <span className="font-display text-[15px] font-semibold tracking-tight">AeroGuard AI</span>
        </Link>

        <ul className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <li key={l.to}>
              <NavLink
                to={l.to}
                className={({ isActive }) =>
                  cn('rounded-full px-4 py-2 text-sm transition-colors', isActive ? 'bg-foreground text-white' : 'text-muted-foreground hover:bg-black/5 hover:text-foreground')
                }
              >
                {l.label}
              </NavLink>
            </li>
          ))}
        </ul>

        <button
          type="button"
          className="grid size-10 place-items-center rounded-full hover:bg-black/5 md:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </nav>

      {open && (
        <div id="mobile-menu" className="glass mx-auto mt-2 max-w-5xl rounded-3xl p-2 md:hidden">
          <ul>
            {links.map((l) => (
              <li key={l.to}>
                <NavLink
                  to={l.to}
                  className={({ isActive }) => cn('block rounded-2xl px-4 py-3 text-[15px]', isActive ? 'bg-foreground text-white' : 'text-foreground hover:bg-black/5')}
                >
                  {l.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  )
}
