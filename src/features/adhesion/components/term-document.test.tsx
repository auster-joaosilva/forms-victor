import { render } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { AdhesionReceipt } from '@/server/adhesion/domain/adhesion'
import { TERM_V4, TERM_V5 } from '@/server/adhesion/domain/term'
import { TermDocument } from './term-document'

const adhesion = (extra: Partial<AdhesionReceipt> = {}): AdhesionReceipt => ({
  protocol: 'ADS-20261001-AB2CD',
  acceptedAt: '2026-10-01T16:00:00.000Z',
  acceptedAtDisplay: '01/10/2026, 13:00:00',
  modalidade: 'hibrido',
  empresa: {
    nomeEmpresa: 'Padaria Boa Massa Ltda',
    cnpj: '11.222.333/0001-81',
    representante: 'Maria Souza',
    cpf: '529.982.247-25',
    cargo: 'Sócio Administrador',
    email: 'maria@boamassa.com.br',
    telefone: '34999990000',
  },
  semManifestacao: 'cancelar',
  querProposta: true,
  termVersion: 'V5',
  termHash: '27bfd24bb5f55bf12b0dd3935769cb51bf434f6a63c515aed1e5254399f8f004',
  originIp: '203.0.113.9',
  ...extra,
})

const text = (node: React.ReactElement) => render(node).container.textContent?.replace(/\s+/g, ' ') ?? ''

describe('TermDocument', () => {
  it('traz identificação, termo integral, modalidade híbrida com a sub-escolha e o registro do aceite', () => {
    const content = text(<TermDocument term={TERM_V5} adhesion={adhesion()} />)
    for (const expected of [
      TERM_V5.titulo,
      TERM_V5.subtitulo,
      '1. Identificação da empresa',
      'Padaria Boa Massa Ltda',
      '11.222.333/0001-81',
      'ADS-20261001-AB2CD',
      '2. Orientação recebida',
      '3. Critérios que orientam a recomendação',
      '4. Serviços complementares',
      `[X] ${TERM_V5.servicos.pergunta}`,
      '5. Modalidade escolhida',
      '[X] Opção 2 — Simples Nacional Híbrido (CBS fora do DAS)',
      TERM_V5.semManifestacao.enunciado,
      '[X] autoriza a Auster a cancelar a opção, retornando ao Simples Puro;',
      '6. Ciência sobre a decisão e reavaliação',
      'Declaração final',
      'Registro do aceite eletrônico',
      'Confirmado por Maria Souza, CPF 529.982.247-25, na qualidade de Sócio Administrador, em 01/10/2026, 13:00:00 (2026-10-01T16:00:00.000Z).',
      'Protocolo ADS-20261001-AB2CD · origem do acesso 203.0.113.9 · versão do termo V5',
      'Resumo criptográfico do texto aceito (SHA-256): 27bfd24bb5f55bf12b0dd3935769cb51bf434f6a63c515aed1e5254399f8f004',
      'O resumo acima identifica o texto exato a que o representante aderiu.',
      TERM_V5.rodape,
    ]) {
      expect(content).toContain(expected)
    }
    expect(content).not.toMatch(/\b(undefined|null|NaN)\b/)
  })

  it('no padrão não mostra a sub-escolha, e sem interesse marca [  ]', () => {
    const content = text(
      <TermDocument
        term={TERM_V5}
        adhesion={adhesion({ modalidade: 'padrao', semManifestacao: null, querProposta: false })}
      />,
    )
    expect(content).toContain('[X] Opção 1 — Simples Nacional Puro (Padrão)')
    expect(content).toContain(`[ ] ${TERM_V5.servicos.pergunta}`)
    expect(content).not.toContain(TERM_V5.semManifestacao.enunciado)
  })

  it('sem origem registrada diz "não registrada"', () => {
    expect(text(<TermDocument term={TERM_V5} adhesion={adhesion({ originIp: null })} />)).toContain(
      'origem do acesso não registrada',
    )
  })

  it('a via de uma adesão V4 sai com o texto da V4', () => {
    const content = text(<TermDocument term={TERM_V4} adhesion={adhesion({ termVersion: 'V4' })} />)
    expect(content).toContain(TERM_V4.semManifestacao.enunciado)
    expect(content).toContain('versão do termo V4')
    expect(content).not.toContain(TERM_V5.semManifestacao.enunciado)
  })

  it('nome com </script> e HTML sai como texto, no SSR e no navegador', () => {
    const hostile = adhesion({ empresa: { ...adhesion().empresa, nomeEmpresa: 'ACME </script><b>x' } })
    const html = renderToString(<TermDocument term={TERM_V5} adhesion={hostile} />)
    expect(html).toContain('ACME &lt;/script&gt;&lt;b&gt;x')
    expect(html).not.toContain('</script><b>x')
    const { container } = render(<TermDocument term={TERM_V5} adhesion={hostile} />)
    expect(container.textContent).toContain('ACME </script><b>x')
    expect([...container.querySelectorAll('b')].some((element) => element.textContent === 'x')).toBe(false)
  })
})
