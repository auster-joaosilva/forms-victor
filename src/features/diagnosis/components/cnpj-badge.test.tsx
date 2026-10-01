import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CnpjBadge } from './cnpj-badge'

const company = { legalName: 'EMPRESA TESTE LTDA', city: 'UBERLANDIA', state: 'MG', simplesOptant: true, meiOptant: false, active: true, registrationStatus: 'ATIVA' }

const text = (node: HTMLElement) => {
  const copy = node.cloneNode(true) as HTMLElement
  copy.querySelectorAll('br').forEach((br) => br.replaceWith(' '))
  return copy.textContent?.replace(/\s+/g, ' ').trim()
}

describe('CnpjBadge', () => {
  it('says what was found, with Simples and MEI', () => {
    const { container } = render(<CnpjBadge state={{ status: 'found', cnpj: '11.222.333/0001-81', company: { ...company, meiOptant: true } }} />)
    expect(text(container)).toBe('EMPRESA TESTE LTDA · UBERLANDIA/MG · optante pelo Simples · MEI')
    expect(container.querySelector('.dx-company.is-found')).not.toBeNull()
  })

  it('warns on a line of its own when the company is not active', () => {
    const { container } = render(<CnpjBadge state={{ status: 'found', cnpj: 'x', company: { ...company, simplesOptant: false, active: false, registrationStatus: 'BAIXADA' } }} />)
    expect(text(container)).toBe('EMPRESA TESTE LTDA · UBERLANDIA/MG · não optante pelo Simples Situação cadastral: BAIXADA. Confirme antes de seguir.')
    expect(container.querySelector('.dx-company.is-warning br')).not.toBeNull()
  })

  it('never blocks: failure asks for the name by hand, loading says so, idle shows nothing', () => {
    expect(text(render(<CnpjBadge state={{ status: 'failed', cnpj: 'x', reason: 'tempo esgotado' }} />).container))
      .toBe('Não deu para consultar o CNPJ agora (tempo esgotado). Preencha o nome da empresa à mão — o diagnóstico segue igual.')
    expect(text(render(<CnpjBadge state={{ status: 'loading', cnpj: 'x' }} />).container)).toBe('Conferindo o cadastro na Receita…')
    expect(render(<CnpjBadge state={{ status: 'idle' }} />).container.innerHTML).toBe('')
  })
})
