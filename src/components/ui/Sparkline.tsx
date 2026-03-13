interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  className?: string
  up?: boolean
}

export default function Sparkline({
  data,
  width = 80,
  height = 24,
  className = '',
  up,
}: SparklineProps) {
  if (!data.length) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const padding = 2
  const w = width - padding * 2
  const h = height - padding * 2
  const points = data
    .map((v, i) => {
      const x = padding + (i / (data.length - 1 || 1)) * w
      const y = padding + h - ((v - min) / range) * h
      return `${x},${y}`
    })
    .join(' ')
  const stroke = up === true ? '#059669' : up === false ? '#dc2626' : '#737373'
  return (
    <svg
      width={width}
      height={height}
      className={className}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        points={points}
      />
    </svg>
  )
}
