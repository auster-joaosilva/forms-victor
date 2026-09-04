import assert from 'node:assert/strict'
import { test } from 'node:test'

import { formatarCpfCnpj, cpfCnpjValido } from './cpf-cnpj'
import { formatarTelefone, telefoneValido, tirarDdi } from './telefone'

test('celular tem 11 digitos e parte em 5+4', () => {
  assert.equal(formatarTelefone('34996556666'), '(34) 99655-6666')
})

test('fixo tem 10 digitos e parte em 4+4 — o erro da mascara antiga', () => {
  assert.equal(formatarTelefone('3432151234'), '(34) 3215-1234')
})

test('DDI colado do WhatsApp e descartado', () => {
  assert.equal(formatarTelefone('+55 34 99655-6666'), '(34) 99655-6666')
  assert.equal(formatarTelefone('+55 34 3215-1234'), '(34) 3215-1234')
})

test('numero de 11 digitos comecando em 55 e DDD 55, nao DDI', () => {
  // Santa Maria (RS) tem DDD 55. Tirar o 55 aqui estragaria numero valido.
  assert.equal(tirarDdi('55996556666'), '55996556666')
  assert.equal(formatarTelefone('55996556666'), '(55) 99655-6666')
})

test('mascara viva: completa parcialmente', () => {
  assert.equal(formatarTelefone(''), '')
  assert.equal(formatarTelefone('3'), '(3')
  assert.equal(formatarTelefone('34'), '(34')
  assert.equal(formatarTelefone('3499'), '(34) 99')
})

test('valido e 10 ou 11 digitos, e nada menos', () => {
  assert.equal(telefoneValido('(1'), false)
  assert.equal(telefoneValido('349965566'), false)
  assert.equal(telefoneValido('3432151234'), true)
  assert.equal(telefoneValido('34996556666'), true)
  assert.equal(telefoneValido('+55 34 99655-6666'), true)
})

test('CPF ate 11 digitos, CNPJ acima disso', () => {
  assert.equal(formatarCpfCnpj('12345678909'), '123.456.789-09')
  assert.equal(formatarCpfCnpj('12345678000195'), '12.345.678/0001-95')
  // Corta em 14: digito a mais nao empurra o formato.
  assert.equal(formatarCpfCnpj('123456780001959'), '12.345.678/0001-95')
})

test('valido e comprimento de CPF ou de CNPJ', () => {
  assert.equal(cpfCnpjValido('123.456.789-09'), true)
  assert.equal(cpfCnpjValido('12.345.678/0001-95'), true)
  assert.equal(cpfCnpjValido('123456'), false)
})
