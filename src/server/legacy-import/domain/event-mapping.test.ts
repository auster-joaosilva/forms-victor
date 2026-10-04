import { describe, expect, it } from 'vitest'
import type { LegacyAgendaEvent, LegacyAgendaSession, LegacyRegistration } from './legacy-rows'
import {
  activeDuplicates, eventConflicts, imageRefOf, legacyContent, mapEvent, mapRegistration, mapSession, registrationConflicts, sessionConflicts,
} from './event-mapping'

const event = (over: Partial<LegacyAgendaEvent> = {}): LegacyAgendaEvent => ({
  id: 3, apelido: 'conexao-tributaria', titulo: 'Conexão Tributária', situacao: 'publicado', inscricoes: 'abertas',
  conteudo: JSON.stringify({ chamada: 'O que muda', temas: ['CBS'], capa: '/imagens/fachada.jpg', palestrante: { nome: 'Victor', foto: '' }, extra: 'fora' }),
  criado_em: '2026-09-20T12:00:00.000Z', criado_por: 'victor', alterado_em: null, alterado_por: null, ...over,
})
const session = (over: Partial<LegacyAgendaSession> = {}): LegacyAgendaSession => ({
  id: 7, evento_id: 3, ordem: 0, data: '2026-11-12', hora: '19:30', formato: 'presencial', titulo: 'Encontro 1', descricao: null, local: 'Auditório', vagas: 30, ...over,
})
const registration = (over: Partial<LegacyRegistration> = {}): LegacyRegistration => ({
  id: 11, protocolo: 'INS-20261001-AAAAA', evento_id: 3, sessao_id: 7, resposta_id: 2, criado_em: '2026-10-01T15:00:00.000Z',
  nome: 'Ana', email: 'Ana@Padaria.com', telefone: '(34) 99999-9999', empresa: 'Padaria', cnpj: '11.222.333/0001-81', cargo: 'Sócio',
  aceite_lgpd: 1, origem: '203.0.113.7', agente: 'Mozilla/5.0', pacote: '{"comoObtido":"x-real-ip"}', situacao: 'presente',
  nota_interna: null, tratado_por: 'maria', tratado_em: '2026-11-12T23:00:00.000Z', ...over,
})

describe('imageRefOf', () => {
  it('reads a base64 jpeg as an upload with a deterministic key', () => {
    const ref = imageRefOf('data:image/jpeg;base64,/9j/4AAQ', 'legacy-agenda-3-capa', 'event_cover')
    expect(ref).toMatchObject({ kind: 'upload', image: { key: 'legacy-agenda-3-capa', kind: 'event_cover', contentType: 'image/jpeg' } })
    if (ref.kind === 'upload') expect(Array.from(ref.image.bytes.slice(0, 3))).toEqual([0xff, 0xd8, 0xff])
  })

  it('reads a house path, an empty value and refuses anything else', () => {
    expect(imageRefOf('/imagens/fachada-larga.jpg', 'k', 'event_cover')).toEqual({ kind: 'house', name: 'fachada-larga.jpg' })
    expect(imageRefOf('', 'k', 'event_cover')).toEqual({ kind: 'none' })
    expect(imageRefOf(undefined, 'k', 'event_cover')).toEqual({ kind: 'none' })
    expect(imageRefOf('/imagens/../segredo.jpg', 'k', 'event_cover')).toMatchObject({ kind: 'invalid' })
    expect(imageRefOf('data:image/gif;base64,R0lG', 'k', 'event_cover')).toMatchObject({ kind: 'invalid' })
    expect(imageRefOf('https://exemplo.com/x.jpg', 'k', 'event_cover')).toMatchObject({ kind: 'invalid' })
  })
})

describe('legacyContent', () => {
  it('keeps only the known keys and swaps the images for file references', () => {
    expect(legacyContent(event().conteudo, { cover: 'f-1', photo: null })).toEqual({
      chamada: 'O que muda', temas: ['CBS'], capa: { fileId: 'f-1' }, palestrante: { nome: 'Victor', foto: null },
    })
    expect(legacyContent('não é json', { cover: null, photo: null })).toEqual({ capa: null })
  })
})

describe('conflicts', () => {
  it('stops on unknown values and invalid dates, ignoring inherited names', () => {
    expect(eventConflicts(event({ situacao: 'constructor', inscricoes: 'talvez', criado_em: 'ontem' }))).toEqual([
      'situação constructor sem equivalente', 'inscrições talvez sem equivalente', 'criado em ontem não é uma data',
    ])
    expect(sessionConflicts(session({ formato: 'toString', data: '12/11/2026' }))).toEqual(['formato toString sem equivalente', 'data 12/11/2026 não é uma data'])
    expect(registrationConflicts(registration({ situacao: '__proto__', tratado_em: 'depois' }))).toEqual([
      'situação __proto__ sem equivalente', 'tratada em depois não é uma data',
    ])
    expect(eventConflicts(event())).toEqual([])
  })

  it('finds the same person twice in a session, ignoring cancelled ones and the e-mail case', () => {
    const rows = [registration(), registration({ id: 12, email: 'ana@padaria.com ' }), registration({ id: 13, email: 'ana@padaria.com', situacao: 'cancelada' })]
    expect(activeDuplicates(rows)).toEqual(['inscrições 11 e 12: o mesmo e-mail ana@padaria.com duas vezes no encontro 7'])
  })
})

describe('mapping', () => {
  it('maps an event, a session and a registration with the new values', () => {
    const userIds = new Map([['victor', 'u-victor'], ['maria', 'u-maria']])
    expect(mapEvent(event(), { content: { chamada: 'O que muda' }, userIds })).toMatchObject({
      id: 3, slug: 'conexao-tributaria', status: 'published', registrations: 'open', createdById: 'u-victor', createdAt: new Date('2026-09-20T12:00:00.000Z'),
      updatedAt: null, updatedById: null,
    })
    expect(mapSession(session())).toEqual({
      id: 7, eventId: 3, order: 0, date: new Date('2026-11-12T00:00:00.000Z'), time: '19:30', format: 'in_person', title: 'Encontro 1',
      description: null, location: 'Auditório', seats: 30,
    })
    expect(mapRegistration(registration(), { protocol: 'INS-20261001-AAAAA', responseIds: new Set([2]), userIds })).toMatchObject({
      id: 11, eventId: 3, sessionId: 7, responseId: 2, name: 'Ana', email: 'Ana@Padaria.com', cnpjDigits: '11222333000181', jobTitle: 'Sócio',
      privacyConsent: true, originIp: '203.0.113.7', userAgent: 'Mozilla/5.0', status: 'present', handledById: 'u-maria',
      payload: { comoObtido: 'x-real-ip' },
    })
    expect(mapRegistration(registration({ resposta_id: 99 }), { protocol: 'P', responseIds: new Set(), userIds })?.responseId).toBeNull()
  })
})
