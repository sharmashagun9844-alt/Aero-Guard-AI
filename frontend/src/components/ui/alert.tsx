import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const alertVariants = cva('flex gap-3 rounded-xl border p-4 text-sm [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0', {
  variants: {
    variant: {
      info: 'border-[#bcdcff] bg-accent text-accent-foreground',
      warning: 'border-[#ecd29c] bg-[#fdf3dc] text-[#6e4300]',
      error: 'border-[#efc0b9] bg-[#fdeceb] text-[#8a2418]',
      success: 'border-[#b8e0cd] bg-[#e9f6ef] text-[#135a3a]',
      demo: 'border-[#d6c6f2] bg-[#f3eefc] text-[#432777]',
    },
  },
  defaultVariants: { variant: 'info' },
})

export function Alert({ className, variant, ...p }: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>) {
  return <div role={variant === 'error' ? 'alert' : 'status'} className={cn(alertVariants({ variant }), className)} {...p} />
}
