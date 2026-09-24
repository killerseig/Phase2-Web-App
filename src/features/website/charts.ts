export function chartGeometry(values: number[]) {
  const clean = values.map((value) => (Number.isFinite(value) ? value : 0))
  const min = Math.min(0, ...clean),
    max = Math.max(0, ...clean)
  const range = max - min || 1
  const positiveTotal = clean.reduce((sum, value) => sum + Math.max(0, value), 0)
  let offset = 0
  return {
    zeroY: 230 - ((0 - min) / range) * 200,
    zero: 180 + ((0 - min) / range) * 430,
    points: clean.map((value, index) => {
      const share = positiveTotal ? (Math.max(0, value) / positiveTotal) * 100 : 0
      const point = {
        value,
        barX: 180 + ((value - min) / range) * 430,
        x: 40 + (index / Math.max(1, clean.length - 1)) * 560,
        y: 230 - ((value - min) / range) * 200,
        share,
        offset,
      }
      offset += share
      return point
    }),
  }
}
