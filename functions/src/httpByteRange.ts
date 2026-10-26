// A server may ignore unsupported/malformed/multipart ranges. Only satisfiable
// single byte ranges produce 206; a valid unsatisfiable one is 416.
export function byteRange(header: string | undefined, size: number) {
  const full = { status: 200, start: 0, end: size - 1, length: size }
  if (!header) return full
  const match = /^bytes=(\d*)-(\d*)$/i.exec(header.trim())
  if (!match || (!match[1] && !match[2])) return full
  const total = BigInt(size)
  const suffix = !match[1]
  const first = BigInt(match[1] || 0), last = BigInt(match[2] || 0)
  const start = suffix ? (last >= total ? 0n : total - last) : first
  const end = suffix || !match[2] || last >= total ? total - 1n : last
  if (!size || (suffix && last === 0n) || start >= total || start > end)
    return { status: 416, start: 0, end: -1, length: 0 }
  return { status: 206, start: Number(start), end: Number(end), length: Number(end - start + 1n) }
}
