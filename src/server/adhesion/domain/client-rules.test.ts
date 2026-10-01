import { describe, expect, it } from 'vitest'
import type { AdhesionCompany } from './adhesion'
import { CLIENT_FIELD_ORDER, ROLE_OPTIONS, clientErrors, isValidCpf, maskCpf } from './client-rules'

const company: AdhesionCompany = {
  nomeEmpresa: 'Empresa Exemplo', cnpj: '11.222.333/0001-81', representante: 'Maria Souza',
  cpf: '529.982.247-25', cargo: 'Sócio', email: 'maria@exemplo.com.br', telefone: '(34) 99999-0000',
}

describe('client rules', () => {
  it('validates CPF check digits and refuses repeated digits', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true)
    expect(isValidCpf('52998224725')).toBe(true)
    expect(isValidCpf('529.982.247-24')).toBe(false)
    expect(isValidCpf('111.111.111-11')).toBe(false)
    expect(isValidCpf('5299822472')).toBe(false)
  })

  it('masks CPF as it is typed', () => {
    expect(maskCpf('52998224725')).toBe('529.982.247-25')
    expect(maskCpf('5299')).toBe('529.9')
    expect(maskCpf('5299822')).toBe('529.982.2')
    expect(maskCpf('529.982.247-25999')).toBe('529.982.247-25')
  })

  it('keeps the closed list of roles in the old order', () => {
    expect(ROLE_OPTIONS).toEqual(['Sócio', 'Sócio Administrador', 'Administrador não Sócio', 'Diretor',
      'Empresário', 'Gerente', 'Administrativo', 'Financeiro', 'Consultor'])
  })

  it('accepts a complete hybrid form', () => {
    expect(clientErrors({ empresa: company, modalidade: 'hibrido', semManifestacao: 'manter', declara: true })).toEqual({})
  })

  it('shows the exact messages of the old screen', () => {
    const empty: AdhesionCompany = { nomeEmpresa: '', cnpj: '', representante: '', cpf: '', cargo: '', email: '', telefone: '' }
    expect(clientErrors({ empresa: empty, modalidade: null, semManifestacao: null, declara: false })).toEqual({
      nomeEmpresa: 'informe a razão social',
      cnpj: 'CNPJ incompleto ou inválido',
      representante: 'informe o nome de quem confirma',
      cpf: 'CPF incompleto ou inválido',
      cargo: 'informe o cargo',
      email: 'e-mail inválido',
      telefone: 'telefone inválido',
      modalidade: 'escolha uma das duas modalidades',
      declara: 'é preciso marcar a declaração para confirmar',
    })
  })

  it('asks for the no-manifestation choice only on the hybrid, with the old 20/11 text', () => {
    // As sobras de "20/11" ficam fiéis à main até o Victor decidir (spec, seção 9).
    expect(clientErrors({ empresa: company, modalidade: 'hibrido', semManifestacao: null, declara: true })).toEqual({
      semManifestacao: 'escolha o que acontece se não houver manifestação até 20/11',
    })
    expect(clientErrors({ empresa: company, modalidade: 'padrao', semManifestacao: null, declara: true })).toEqual({})
  })

  it('requires phone on the screen, unlike the server', () => {
    expect(clientErrors({ empresa: { ...company, telefone: '' }, modalidade: 'padrao', semManifestacao: null, declara: true }))
      .toEqual({ telefone: 'telefone inválido' })
  })

  it('scrolls to errors in the order of the old page', () => {
    expect(CLIENT_FIELD_ORDER).toEqual(['cnpj', 'nomeEmpresa', 'representante', 'cargo', 'cpf', 'email',
      'telefone', 'modalidade', 'semManifestacao', 'declara'])
  })
})
