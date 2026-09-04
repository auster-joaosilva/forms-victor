import assert from 'node:assert/strict'
import { test } from 'node:test'

import { ULTIMO_ANO_COBERTO } from '../config/feriados'
import {
  HORAS_POR_PRIORIDADE,
  calcularRetorno,
  feriadosCobrem,
  prioridadeDe,
  somarHorasUteis,
} from './prazo'

/** Instante a partir da hora de parede de Sao Paulo (UTC-3, sem verao). */
const brt = (iso: string) => new Date(`${iso}-03:00`)

/** De volta para hora de parede de Sao Paulo, para comparar legivel. */
const comoBrt = (data: Date) =>
  new Date(data.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 16)

test('prioridade sai das duas respostas juntas', () => {
  assert.equal(prioridadeDe('sim', 'muito_interessado'), 'A')
  assert.equal(prioridadeDe('sim', 'nao_abordado'), 'B')
  assert.equal(prioridadeDe('nao', 'muito_interessado'), 'C')
  assert.equal(prioridadeDe('nao', 'pouco_interessado'), 'D')
  // Resposta em branco nao pode virar urgencia.
  assert.equal(prioridadeDe('', ''), 'D')
})

test('horas de SLA saem da prioridade', () => {
  assert.deepEqual(HORAS_POR_PRIORIDADE, { A: 4, B: 8, C: 48, D: 72 })
})

test('dentro do horario, soma na hora', () => {
  // Terca 01/09/2026, 10:00 + 4 h uteis = 14:00 do mesmo dia.
  assert.equal(comoBrt(somarHorasUteis(brt('2026-09-01T10:00'), 4)), '2026-09-01T14:00')
})

test('estoura o fechamento e continua na abertura do dia seguinte', () => {
  // 15:00 + 4 h: sobram 2,5 h ate 17:30, faltam 1,5 h -> 10:30 de quarta.
  assert.equal(comoBrt(somarHorasUteis(brt('2026-09-01T15:00'), 4)), '2026-09-02T10:30')
})

test('antes da abertura comeca as 09:00 do mesmo dia', () => {
  assert.equal(comoBrt(somarHorasUteis(brt('2026-09-01T06:00'), 4)), '2026-09-01T13:00')
})

test('depois do fechamento comeca na abertura do proximo dia util', () => {
  assert.equal(comoBrt(somarHorasUteis(brt('2026-09-01T20:00'), 4)), '2026-09-02T13:00')
})

test('fim de semana nao conta', () => {
  // Sabado 05/09/2026 -> comeca segunda 07/09... que e feriado (Independencia),
  // logo terca 08/09 as 09:00 + 4 h = 13:00.
  assert.equal(comoBrt(somarHorasUteis(brt('2026-09-05T10:00'), 4)), '2026-09-08T13:00')
})

test('feriado no meio do caminho e pulado', () => {
  // Sexta 04/09/2026 16:00 + 8 h uteis: 1,5 h ate 17:30; restam 6,5 h.
  // Segunda 07/09 e feriado -> terca 08/09, 09:00 + 6,5 h = 15:30.
  assert.equal(comoBrt(somarHorasUteis(brt('2026-09-04T16:00'), 8)), '2026-09-08T15:30')
})

test('72 h uteis atravessam mais de uma semana', () => {
  // Quarta 02/09/2026 09:00. Dia util tem 8,5 h; 72 h = 8 dias e 4 h.
  // 02,03,04 (3 dias), 07 e feriado, 08,09,10,11,14 (mais 5) -> 8 dias cheios
  // vencem em 14/09 as 17:30; sobram 4 h -> 15/09 as 13:00.
  assert.equal(comoBrt(somarHorasUteis(brt('2026-09-02T09:00'), 72)), '2026-09-15T13:00')
})

test('calcularRetorno devolve letra, horas e data coerentes', () => {
  const r = calcularRetorno('sim', 'muito_interessado', brt('2026-09-01T10:00'))
  assert.equal(r.prioridade, 'A')
  assert.equal(r.horas, 4)
  assert.equal(comoBrt(r.retornoPrevistoEm), '2026-09-01T14:00')
})

test('a lista de feriados cobre o ano corrente', () => {
  // Falha de proposito quando o ano passar da cobertura: prazo calculado sem
  // os feriados do ano e SLA errado em silencio.
  assert.equal(
    feriadosCobrem(new Date()),
    true,
    `Acrescente os feriados de ${ULTIMO_ANO_COBERTO + 1} em config/feriados.ts`,
  )
})
