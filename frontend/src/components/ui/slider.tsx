import * as SliderPrimitive from '@radix-ui/react-slider'
import { cn } from '@/lib/utils'

export function Slider({ className, ...p }: React.ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root className={cn('relative flex h-6 w-full touch-none select-none items-center', className)} {...p}>
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-black/10">
        <SliderPrimitive.Range className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block size-5 rounded-full border border-black/10 bg-white shadow-[0_2px_8px_rgb(25_33_44/0.25)] transition-transform hover:scale-110 focus-visible:scale-110" />
    </SliderPrimitive.Root>
  )
}
