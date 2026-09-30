import { describe, expect, it } from 'vitest'
import * as legacy from '../../../../legacy/src/validacao.js'
import { VALIDATORS, isValidCnpj, isValidEmail, isValidName, isValidPhone, maskCnpj, maskPhone } from './validation'

const cnpjs = ['12.ABC.345/01DE-35', '11.222.333/0001-81', '11.111.111/1111-11', '12ABC34501DE3', 'ab.cde.fgh/ijkl-00', '']
const phones = ['(34) 99999-1234', '3432101234', '1199999123', '(00) 91234-5678', '34 2345-6789', '12']
const emails = ['a@b.co', 'a..b@c.com', '.a@b.com', 'a@b', 'nome.sobrenome+tag@empresa.com.br', 'a b@c.com']
const names = ['Ana', 'Jo', 'Ângela Souza', '---', 'A1']

describe('validation parity with legacy', () => {
  it.each(cnpjs)('cnpj %s', (value) => {
    expect(maskCnpj(value)).toBe(legacy.mascararCnpj(value))
    expect(isValidCnpj(value)).toBe(legacy.cnpjValido(value))
  })
  it.each(phones)('phone %s', (value) => {
    expect(maskPhone(value)).toBe(legacy.mascararTelefone(value))
    expect(isValidPhone(value)).toBe(legacy.telefoneValido(value))
  })
  it.each(emails)('email %s', (value) => expect(isValidEmail(value)).toBe(legacy.emailValido(value)))
  it.each(names)('name %s', (value) => {
    expect(isValidName(value)).toBe(legacy.nomeValido(value))
    expect(isValidName(value, 5)).toBe(legacy.nomeValido(value, 5))
  })
  it('keeps error messages', () => {
    expect(VALIDATORS.cnpj.error).toBe(legacy.VALIDADORES.cnpj.erro)
    expect(VALIDATORS.phone.error).toBe(legacy.VALIDADORES.telefone.erro)
    expect(VALIDATORS.email.error).toBe(legacy.VALIDADORES.email.erro)
    expect(VALIDATORS.companyName.error).toBe(legacy.VALIDADORES.nomeEmpresa.erro)
    expect(VALIDATORS.personName.error).toBe(legacy.VALIDADORES.nomePessoa.erro)
  })
  it('accepts the official alphanumeric example', () => expect(isValidCnpj('12.ABC.345/01DE-35')).toBe(true))
})
