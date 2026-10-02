import { describe, expect, it } from 'vitest'
import { loadAdhesionPageInput, lookupAdhesionCompanyInput, submitAdhesionInput } from './schemas'

const valid = {
  vinculo: null,
  versaoTermo: 'V5',
  empresa: {
    nomeEmpresa: 'Padaria Boa Massa Ltda',
    cnpj: '11.222.333/0001-81',
    representante: 'Maria Souza',
    cpf: '529.982.247-25',
    cargo: 'Sócio',
    email: 'maria@boamassa.com.br',
    telefone: '',
  },
  modalidade: 'hibrido',
  semManifestacao: 'cancelar',
  querProposta: false,
  declara: true,
}

describe('adhesion schemas', () => {
  it('aceita um envio completo e um convite nulo', () => {
    expect(submitAdhesionInput.safeParse(valid).success).toBe(true)
    expect(loadAdhesionPageInput.safeParse({ invite: null }).success).toBe(true)
  })

  it('corta tamanho antes de chegar ao caso de uso', () => {
    expect(loadAdhesionPageInput.safeParse({ invite: 'x'.repeat(33) }).success).toBe(false)
    expect(lookupAdhesionCompanyInput.safeParse({ cnpj: '1'.repeat(33) }).success).toBe(false)
    expect(
      submitAdhesionInput.safeParse({ ...valid, empresa: { ...valid.empresa, nomeEmpresa: 'x'.repeat(301) } })
        .success,
    ).toBe(false)
    expect(submitAdhesionInput.safeParse({ ...valid, vinculo: 'x'.repeat(33) }).success).toBe(false)
  })

  it('deixa para o servidor as recusas com mensagem: modalidade e versão chegam como texto', () => {
    expect(submitAdhesionInput.safeParse({ ...valid, modalidade: 'outra', versaoTermo: 'V4' }).success).toBe(
      true,
    )
  })
})
