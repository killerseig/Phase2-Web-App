import { describe, expect, it } from 'vitest'
import { byteRange } from './httpByteRange'
describe('bounded single HTTP byte ranges', () => {
  it.each([
    ['bytes=0-9', 10, 206, 0, 9, 10],
    ['bytes=3-', 10, 206, 3, 9, 7],
    ['bytes=-3', 10, 206, 7, 9, 3],
    ['bytes=-99999999999999999999999', 10, 206, 0, 9, 10],
    ['Bytes=5-99999999999999999999999', 10, 206, 5, 9, 5],
    ['bytes=99999999999999999999999-', 10, 416, 0, -1, 0],
    ['bytes=10-', 10, 416, 0, -1, 0],
    ['bytes=-0', 10, 416, 0, -1, 0],
    ['bytes=8-2', 10, 416, 0, -1, 0],
    ['bytes=0-0', 0, 416, 0, -1, 0],
  ])('%s on %d bytes', (header, size, status, start, end, length) => {
    expect(byteRange(header as string, size as number)).toEqual({ status, start, end, length })
  })
  it.each([undefined, 'bytes=-', 'nibbles=0-2', 'bytes=0-2,5-9', 'bytes=hello', 'bytes=1.5-2', 'bytes=+1-2'])('falls back to the original full body for %s', header => {
    expect(byteRange(header, 10)).toEqual({ status: 200, start: 0, end: 9, length: 10 })
  })
})
