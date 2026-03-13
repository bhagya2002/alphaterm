import type { Alert } from '../../store/alertStore'

interface AlertCardProps {
  alert: Alert
  onDismiss?: (id: string) => void
}

export default function AlertCard({ alert, onDismiss }: AlertCardProps) {
  return (
    <div className="border border-border rounded-lg p-3 bg-white">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="font-medium text-stone-800">{alert.ticker}</span>
          <span className="text-muted text-sm ml-2">{alert.alert_type}</span>
          <p className="mt-1 text-sm text-stone-600">{alert.message}</p>
          <p className="mt-1 text-xs text-muted">
            {new Date(alert.triggered_at).toLocaleString()}
          </p>
        </div>
        {onDismiss && !alert.dismissed && (
          <button
            type="button"
            onClick={() => onDismiss(alert.id)}
            className="text-xs text-muted hover:text-stone-700"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  )
}
