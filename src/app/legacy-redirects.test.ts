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
  ])('%s -> %s', (from, to) => expect(resolve(from)).toBe(to))

  it.each(['/', '/diagnosis', '/events/x', '/backoffice', '/health', '/%zz'])('leaves %s alone', (path) =>
    expect(resolve(path)).toBeNull(),
  )
})
