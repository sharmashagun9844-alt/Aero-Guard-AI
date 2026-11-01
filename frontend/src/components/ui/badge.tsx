import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium', {
  variants: {
    variant: {
      neutral: 'border-border bg-white text-muted-foreground',
      sky: 'border-[#bcdcff] bg-accent text-accent-foreground',
      healthy: 'border-[#b8e0cd] bg-[#e9f6ef] text-healthy',
      warning: 'border-[#ecd29c] bg-[#fdf3dc] text-warning',
      critical: 'border-[#efc0b9] bg-[#fdeceb] text-critical',
      demo: 'border-[#d6c6f2] bg-[#f3eefc] text-[#5b36a3]',
    },
  },
  defaultVariants: { variant: 'neutral' },
})

export function Badge({ className, variant, ...p }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...p} />
}
