import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '@/lib/utils'

export const Tabs = TabsPrimitive.Root
export function TabsList({ className, ...p }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn('inline-flex h-10 items-center gap-1 rounded-full bg-black/[0.05] p-1', className)} {...p} />
}
export function TabsTrigger({ className, ...p }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn('inline-flex h-8 items-center rounded-full px-4 text-[13px] font-medium text-muted-foreground transition-colors data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm', className)}
      {...p}
    />
  )
}
export const TabsContent = TabsPrimitive.Content
