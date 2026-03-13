interface ScoreBadgeProps {
  score: number
  label?: string
  size?: 'sm' | 'md'
}

const scoreColor = (score: number) => {
  if (score >= 70) return 'bg-emerald-100 text-emerald-800'
  if (score >= 50) return 'bg-amber-100 text-amber-800'
  return 'bg-red-100 text-red-800'
}

export default function ScoreBadge({ score, label, size = 'md' }: ScoreBadgeProps) {
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1'
  return (
    <span
      className={`inline-flex items-center font-medium rounded ${sizeClass} ${scoreColor(score)}`}
      title={label}
    >
      {score}
      {label && <span className="ml-1 opacity-80">{label}</span>}
    </span>
  )
}
