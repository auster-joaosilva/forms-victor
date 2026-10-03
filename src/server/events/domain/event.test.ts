import { describe, expect, it } from 'vitest'
import {
  EVENT_STATUS_LABELS, REGISTRATION_STATUS_LABELS, REGISTRATION_STATUS_LEGACY, SESSION_FORMAT_LABELS, SESSION_FORMAT_LEGACY,
  isEventStatus, isRegistrationStatus, isRegistrationWindow, isSessionFormat, parseContent, sessionLabel, sessionOptionLabel, themeOf,
  type EventSessionView,
} from './event'

const session = (overrides: Partial<EventSessionView> = {}): EventSessionView => ({
  id: 7, order: 0, date: '2026-10-21', time: '19:30', format: 'in_person', title: 'Conexão Tributária',
  description: null, location: 'Auditório da Auster', seats: 40, taken: 3, ...overrides,
})

describe('rótulos da main', () => {
  it('traduz situação do evento, da inscrição e formato como o backoffice antigo', () => {
    expect(EVENT_STATUS_LABELS).toEqual({ draft: 'Rascunho', published: 'Publicado', closed: 'Encerrado' })
    expect(REGISTRATION_STATUS_LABELS).toEqual({
      registered: 'Inscrita', confirmed: 'Confirmada', present: 'Presente', absent: 'Ausente', cancelled: 'Cancelada',
    })
    expect(SESSION_FORMAT_LABELS).toEqual({ in_person: 'Presencial', online: 'Online' })
  })

  it('guarda o valor cru do banco antigo para a planilha', () => {
    expect(REGISTRATION_STATUS_LEGACY).toEqual({
      registered: 'inscrita', confirmed: 'confirmada', present: 'presente', absent: 'ausente', cancelled: 'cancelada',
    })
    expect(SESSION_FORMAT_LEGACY).toEqual({ in_person: 'presencial', online: 'online' })
  })

  it('reconhece só os valores de cada enum, sem chave herdada', () => {
    expect(isEventStatus('published')).toBe(true)
    expect(isEventStatus('publicado')).toBe(false)
    expect(isRegistrationWindow('open')).toBe(true)
    expect(isSessionFormat('online')).toBe(true)
    expect(isRegistrationStatus('present')).toBe(true)
    expect(isRegistrationStatus('constructor')).toBe(false)
    expect(isRegistrationStatus(undefined)).toBe(false)
  })
})

describe('parseContent', () => {
  it('fica só com as chaves conhecidas e os tipos certos', () => {
    const content = parseContent({
      chamada: 'Inscrição gratuita.', local: 'Auditório', intro: 'Abertura', tema: 'onda', rotulo: 'Encontro gratuito',
      destaques: [{ titulo: 'Prazos', texto: 'O que muda' }, { titulo: 1 }, 'lixo'],
      temas: ['CBS', 2, 'IBS'], avisos: ['Chegue cedo'], aposEncerrar: 'Fale com a Auster',
      capa: { fileId: '1b4e28ba-2fa1-41d2-883f-0016d3cca427' },
      palestrante: { nome: 'Ana', cargo: 'Sócia', bio: 'Contadora', foto: { fileId: 'nao-e-uuid' } },
      extra: 'descartada',
    })
    expect(content).toEqual({
      chamada: 'Inscrição gratuita.', local: 'Auditório', intro: 'Abertura', tema: 'onda', rotulo: 'Encontro gratuito',
      destaques: [{ titulo: 'Prazos', texto: 'O que muda' }],
      temas: ['CBS', 'IBS'], avisos: ['Chegue cedo'], aposEncerrar: 'Fale com a Auster',
      capa: { fileId: '1b4e28ba-2fa1-41d2-883f-0016d3cca427' },
      palestrante: { nome: 'Ana', cargo: 'Sócia', bio: 'Contadora', foto: null },
    })
  })

  it('devolve objeto vazio para o que não é objeto', () => {
    expect(parseContent(null)).toEqual({})
    expect(parseContent('texto')).toEqual({})
    expect(parseContent([1, 2])).toEqual({})
  })

  it('descarta capa em base64 ou caminho antigo: imagem só por referência', () => {
    expect(parseContent({ capa: 'data:image/jpeg;base64,AAAA' }).capa).toBeNull()
    expect(parseContent({ capa: '/imagens/fachada.jpg' }).capa).toBeNull()
  })

  it('tema desconhecido ou vazio vale marca (correção V2c)', () => {
    expect(themeOf({})).toBe('marca')
    expect(themeOf({ tema: 'aurora' })).toBe('aurora')
    expect(themeOf(parseContent({ tema: 'neon' }))).toBe('marca')
  })

  it('tema foto sem capa cai para marca, como a página antiga', () => {
    expect(themeOf({ tema: 'foto' })).toBe('marca')
    expect(themeOf({ tema: 'foto', capa: { fileId: '1b4e28ba-2fa1-41d2-883f-0016d3cca427' } })).toBe('foto')
  })
})

describe('rótulos da sessão', () => {
  it('monta a linha do recibo como a main: "DD/MM/AAAA, hora — Formato: título"', () => {
    expect(sessionLabel(session())).toBe('21/10/2026, 19:30 — Presencial: Conexão Tributária')
    expect(sessionLabel(session({ title: '', format: 'online' }))).toBe('21/10/2026, 19:30 — Online')
  })

  it('monta a opção do select com o selo em minúsculas', () => {
    expect(sessionOptionLabel(session(), 'Últimas 3 vagas')).toBe('21/10/2026 19:30 — Presencial: Conexão Tributária (últimas 3 vagas)')
    expect(sessionOptionLabel(session(), null)).toBe('21/10/2026 19:30 — Presencial: Conexão Tributária')
  })
})
