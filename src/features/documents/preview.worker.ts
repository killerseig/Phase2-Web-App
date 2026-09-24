import type { FilePreview, TablePreview } from './formats'

function csvRows(text: string): TablePreview {
  const rows: string[][] = []
  let row: string[] = [],
    field = '',
    quoted = false,
    truncated = false
  const saveField = () => {
    if (row.length < 50) row.push(field)
    else truncated = true
    field = ''
  }
  for (let i = 0; i <= text.length; i++) {
    const char = text[i]
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"'
        i++
      } else quoted = !quoted
    } else if ((char === ',' && !quoted) || char === undefined) {
      saveField()
      if (char === undefined && row.some((cell) => cell.length)) rows.push(row)
    } else if ((char === '\n' || char === '\r') && !quoted) {
      saveField()
      rows.push(row)
      row = []
      if (char === '\r' && text[i + 1] === '\n') i++
      if (rows.length >= 500) {
        truncated = truncated || i + 1 < text.length
        break
      }
    } else field += char
  }
  return { name: 'CSV', rows, truncated }
}
self.onmessage = async (event: MessageEvent<{ extension: string; bytes: ArrayBuffer }>) => {
  try {
    const { extension, bytes } = event.data
    let result: FilePreview
    if (extension === 'xlsx') {
      const { default: readExcelFile } = await import('read-excel-file/web-worker')
      const sheets = await readExcelFile(bytes)
      result = {
        tables: sheets.map((sheet) => ({
          name: sheet.sheet,
          truncated: sheet.data.length > 500 || sheet.data.some((row) => row.length > 50),
          rows: sheet.data
            .slice(0, 500)
            .map((row) =>
              row
                .slice(0, 50)
                .map((cell) =>
                  cell instanceof Date
                    ? cell.toISOString().slice(0, 10)
                    : cell == null
                      ? ''
                      : String(cell),
                ),
            ),
        })),
      }
    } else if (extension === 'csv') {
      result = { tables: [csvRows(new TextDecoder('utf-8', { fatal: true }).decode(bytes))] }
    } else {
      const text =
        extension === 'docx'
          ? (await (await import('mammoth')).extractRawText({ arrayBuffer: bytes })).value
          : new TextDecoder('utf-8', { fatal: true }).decode(bytes)
      result = { text: text.slice(0, 200000), truncated: text.length > 200000 }
    }
    self.postMessage({ result })
  } catch {
    self.postMessage({
      error:
        'This file could not be previewed. Download the original to open it in its application.',
    })
  }
}
