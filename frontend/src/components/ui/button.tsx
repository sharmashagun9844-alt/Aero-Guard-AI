import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-[background-color,color,box-shadow,transform] duration-200 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-foreground text-white shadow-sm hover:bg-[#2a3544]',
        primary: 'bg-primary text-primary-foreground shadow-[0_6px_18px_-8px_rgb(10_107_214/0.7)] hover:bg-[#0959b3]',
        secondary: 'bg-white text-foreground border border-border shadow-sm hover:bg-secondary',
        ghost: 'text-foreground hover:bg-black/5',
        glass: 'glass text-foreground hover:bg-white/90',
      },
      size: { default: 'h-11 px-5', sm: 'h-9 px-4 text-[13px]', lg: 'h-12 px-7 text-[15px]', icon: 'size-10' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />
}
export { buttonVariants }
