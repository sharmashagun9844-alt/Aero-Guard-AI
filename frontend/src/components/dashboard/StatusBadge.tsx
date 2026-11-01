import { CheckCircle2, OctagonAlert, TriangleAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { STATUS_LABEL } from '@/lib/sensors'
import type { Status } from '@/lib/types'

const ICON = { healthy: CheckCircle2, warning: TriangleAlert, critical: OctagonAlert } as const

/** Status is always icon + words, never colour alone. */
export function StatusBadge({ status }: { status: Status }) {
  const Icon = ICON[status]
  return (
    <Badge variant={status}>
      <Icon className="size-3.5" aria-hidden />
      {STATUS_LABEL[status]}
    </Badge>
  )
}
