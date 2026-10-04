import { describe, expect, it } from 'vitest'
import { resolveLegacyRedirect } from './legacy-redirects'

const resolve = (path: string) => resolveLegacyRedirect(new URL(path, 'https://hml-reforma.austercontabil.com.br'))

describe('legacy redirects', () => {
  it.each([
    ['/?c=ABC123', '/diagnosis?invite=ABC123'],
    ['/diagnostico-simples', '/diagnosis'],
    ['/diagn%C3%B3stico-simples?c=X', '/diagnosis?invite=X'],
    ['/index.html', '/'],
    ['/principal', '/'],
    ['/Principal', '/'],
    ['/adesao?c=TOK', '/adhesion?invite=TOK'],
    ['/adesao', '/adhesion'],
    ['/eventos', '/events'],
    ['/eventos/encontro-outubro', '/events/encontro-outubro'],
    ['/entrar', '/login'],
    ['/sair', '/logout'],
    ['/saude', '/health'],
    ['/backoffice/relatorio?id=42', '/backoffice/responses/42/report'],
    ['/backoffice/termo?id=7', '/backoffice/adhesions/7/term'],
    ['/diagnostico-simples?c=A&utm_source=wpp', '/diagnosis?utm_source=wpp&invite=A'],
    ['/eventos/encontro-outubro?utm_source=wpp&x=1', '/events/encontro-outubro?utm_source=wpp&x=1'],
    ['/backoffice/relatorio?id=42&x=1', '/backoffice/responses/42/report?x=1'],
    ['/backoffice/relatorio?x=1&id=42', '/backoffice/responses/42/report?x=1'],
    ['/backoffice/termo?id=7&x=1', '/backoffice/adhesions/7/term?x=1'],
    ['/eventos/%2F%2Fevil.com', '/events/%2F%2Fevil.com'],
    ['/eventos//x', '/events/%2Fx'],
    ['/eventos/a/b', '/events/a%2Fb'],
    ['/eventos/%2F%2Fevil.com?next=//evil.com', '/events/%2F%2Fevil.com?next=//evil.com'],
  ])('%s -> %s', (from, to) => expect(resolve(from)).toBe(to))

  it.each(['/', '/diagnosis', '/events/x', '/backoffice', '/health', '/%zz', '/imagens/fachada.jpg', '/imagens/recepcao-lateral.jpg', '/events'])('leaves %s alone', (path) =>
    expect(resolve(path)).toBeNull(),
  )

  it.each(['/eventos/%2F%2Fevil.com', '/eventos//x', '/eventos/a/b', '/eventos/%5C%5Cevil.com'])('keeps %s under /events/', (path) => {
    const target = resolve(path) ?? ''
    expect(target.startsWith('/events/')).toBe(true)
    expect(new URL(target, 'https://hml-reforma.austercontabil.com.br').origin).toBe('https://hml-reforma.austercontabil.com.br')
    expect(new URL(target, 'https://hml-reforma.austercontabil.com.br').pathname.startsWith('/events/')).toBe(true)
  })
})
