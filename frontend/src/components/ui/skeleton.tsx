import { cn } from '@/lib/utils'
export function Skeleton({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn('animate-pulse rounded-md bg-black/[0.06]', className)} {...p} />
}
