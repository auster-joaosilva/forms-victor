import { describe, expect, it } from 'vitest'
import { isValidCnpj, maskPhone } from './validation'

describe('validation', () => {
  it('accepts the official alphanumeric CNPJ example', () => expect(isValidCnpj('12.ABC.345/01DE-35')).toBe(true))
  it('rejects a CNPJ with all digits equal', () => expect(isValidCnpj('11.111.111/1111-11')).toBe(false))
  it('masks a mobile phone', () => expect(maskPhone('34999991234')).toBe('(34) 99999-1234'))
})
