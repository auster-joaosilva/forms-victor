import { describe, expect, it } from 'vitest'
import { neutralised, toCsv } from './csv-format'

describe('csv format', () => {
  it('writes BOM, semicolons and CRLF, quoting only what needs it', () => {
    expect(toCsv([['a', 'b;c'], ['d "e"', 'f\ng']])).toBe('\uFEFFa;"b;c"\r\n"d ""e""";"f\ng"\r\n')
  })

  it('neutralises what Excel would read as a formula', () => {
    expect(neutralised('=HYPERLINK("http://x")')).toBe(`'=HYPERLINK("http://x")`)
    expect(neutralised('+5511')).toBe(`'+5511`)
    expect(neutralised('-1')).toBe(`'-1`)
    expect(neutralised('@SUM(A1)')).toBe(`'@SUM(A1)`)
    expect(neutralised('Empresa')).toBe('Empresa')
  })
})
