import { useState } from 'react'
import { toast } from 'sonner'
import { REPORT_REASONS } from '@shared/constants'
import { Button, Chip, Sheet, inputClass } from '@/components/ui/primitives'
import { api } from '@/lib/api'

export interface ReportTarget {
  kind: 'video' | 'comment'
  id: string
}

export function ReportSheet({ target, onClose }: { target: ReportTarget | null; onClose: () => void }) {
  const [reason, setReason] = useState<string>('')
  const [details, setDetails] = useState('')
  const [sending, setSending] = useState(false)

  const close = () => {
    setReason('')
    setDetails('')
    onClose()
  }

  const submit = async () => {
    if (!target || !reason) return
    setSending(true)
    try {
      await api(`${target.kind === 'video' ? 'videos' : 'comments'}/${target.id}/report`, {
        method: 'POST',
        body: { reason, details },
      })
      toast.success('Thanks. We will review this.')
      close()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not send the report')
    } finally {
      setSending(false)
    }
  }

  return (
    <Sheet open={target !== null} onClose={close} title={target?.kind === 'comment' ? 'Report comment' : 'Report video'}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Reason">
          {REPORT_REASONS.map((item) => (
            <Chip key={item.value} active={reason === item.value} onClick={() => setReason(item.value)}>
              {item.label}
            </Chip>
          ))}
        </div>
        <textarea
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          maxLength={500}
          rows={3}
          placeholder="Anything we should know? (optional)"
          aria-label="Details"
          className={inputClass}
        />
        <Button full loading={sending} disabled={!reason} onClick={() => void submit()}>
          Send report
        </Button>
      </div>
    </Sheet>
  )
}
