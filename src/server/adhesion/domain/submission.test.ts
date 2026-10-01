import { describe, expect, it } from 'vitest'
import type { AdhesionWindow } from './window'
import { checkSubmission, cnpjDigitsOf } from './submission'

const open: AdhesionWindow = { state: 'open', end: '2026-10-30' }
const closed: AdhesionWindow = { state: 'closed', end: '2026-10-30' }
const ctx = { window: open, currentVersion: 'V5' }

const valid = () => ({
  vinculo: 'ABCDEFGHJK',
  versaoTermo: 'V5',
  empresa: {
    nomeEmpresa: '  Empresa Exemplo Ltda ', cnpj: '11.222.333/0001-81', representante: 'Maria Souza',
    cpf: '529.982.247-25', cargo: 'Sócio', email: 'maria@exemplo.com.br', telefone: ' (34) 99999-0000 ',
  },
  modalidade: 'hibrido',
  semManifestacao: 'cancelar',
  querProposta: true,
  declara: true,
})

const refusal = (body: unknown, context = ctx) => {
  const result = checkSubmission(body, context)
  return result.ok ? null : result.error
}

describe('checkSubmission', () => {
  it('normalises a valid hybrid submission', () => {
    const result = checkSubmission(valid(), ctx)
    expect(result).toEqual({
      ok: true,
      value: {
        empresa: {
          nomeEmpresa: 'Empresa Exemplo Ltda', cnpj: '11.222.333/0001-81', representante: 'Maria Souza',
          cpf: '529.982.247-25', cargo: 'Sócio', email: 'maria@exemplo.com.br', telefone: '(34) 99999-0000',
        },
        modalidade: 'hibrido',
        semManifestacao: 'cancelar',
        querProposta: true,
        vinculo: 'ABCDEFGHJK',
      },
    })
  })

  it('drops the no-manifestation choice when the modality is standard', () => {
    const result = checkSubmission({ ...valid(), modalidade: 'padrao', semManifestacao: 'manter' }, ctx)
    expect(result.ok && result.value.semManifestacao).toBeNull()
  })

  it('keeps phone optional on the server and turns it into an empty string', () => {
    const body = valid()
    const result = checkSubmission({ ...body, empresa: { ...body.empresa, telefone: undefined } }, ctx)
    expect(result.ok && result.value.empresa.telefone).toBe('')
  })

  it('only takes querProposta when it is exactly true, and vinculo only as a non-empty string', () => {
    const result = checkSubmission({ ...valid(), querProposta: 'sim', vinculo: 42 }, ctx)
    expect(result.ok && result.value.querProposta).toBe(false)
    expect(result.ok && result.value.vinculo).toBeNull()
  })

  it('refuses in the order of the old portal, with its exact messages', () => {
    expect(refusal(null)).toBe('corpo inválido')
    expect(refusal('texto')).toBe('corpo inválido')
    expect(refusal(valid(), { window: closed, currentVersion: 'V5' })).toBe(
      'a janela de opção encerrou em 30/10/2026; fale com a equipe da Auster',
    )
    // a janela vem antes de tudo, inclusive da declaração
    expect(refusal({ ...valid(), declara: false }, { window: closed, currentVersion: 'V5' })).toContain('encerrou')
    expect(refusal({ ...valid(), declara: 'true' })).toBe('sem a declaração final marcada')
    expect(refusal({ ...valid(), modalidade: 'misto' })).toBe('modalidade inválida')
    expect(refusal({ ...valid(), semManifestacao: null })).toBe('falta escolher o que acontece sem manifestação até 10/12')
    expect(refusal({ ...valid(), versaoTermo: 'V4' })).toBe('o termo foi atualizado; recarregue a página e confirme de novo')
  })

  it('names the first missing company field', () => {
    const body = valid()
    const without = (field: string) => refusal({ ...body, empresa: { ...body.empresa, [field]: '   ' } })
    expect(without('nomeEmpresa')).toBe('falta razão social')
    expect(without('cnpj')).toBe('falta CNPJ')
    expect(without('representante')).toBe('falta nome do representante')
    expect(without('cpf')).toBe('falta CPF')
    expect(without('cargo')).toBe('falta cargo')
    expect(without('email')).toBe('falta e-mail')
    expect(refusal({ ...body, empresa: undefined })).toBe('falta razão social')
  })

  it('checks only the length of CNPJ and CPF, as the old server did', () => {
    const body = valid()
    expect(refusal({ ...body, empresa: { ...body.empresa, cnpj: '11.222.333/0001' } })).toBe('CNPJ incompleto')
    expect(refusal({ ...body, empresa: { ...body.empresa, cpf: '529.982.247' } })).toBe('CPF incompleto')
    // dígito verificador errado passa no servidor (a tela é que confere)
    expect(checkSubmission({ ...body, empresa: { ...body.empresa, cpf: '111.222.333-44' } }, ctx).ok).toBe(true)
    // CNPJ alfanumérico conta letras
    expect(checkSubmission({ ...body, empresa: { ...body.empresa, cnpj: '12.ABC.345/01DE-35' } }, ctx).ok).toBe(true)
  })

  it('extracts the CNPJ digits as the old soDigitos did', () => {
    expect(cnpjDigitsOf('12.abc.345/01de-35')).toBe('12ABC34501DE35')
    expect(cnpjDigitsOf('11.222.333/0001-81')).toBe('11222333000181')
  })
})
