// A leading =, +, -, @, tab or CR makes Excel read client-typed text as a formula.
export const neutralised = (value: string): string => (/^[=+\-@\t\r]/.test(value) ? `'${value}` : value)

const cell = (raw: string): string => {
  const value = neutralised(raw)
  return /[";\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

// Semicolon and BOM because the destination is Excel in Portuguese.
export const toCsv = (rows: string[][]): string => `\uFEFF${rows.map((row) => row.map(cell).join(';')).join('\r\n')}\r\n`
