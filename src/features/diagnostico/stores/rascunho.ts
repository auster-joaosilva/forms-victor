import { contatoVazio, valoresIniciais } from '../types'

import type { DiagnosticoValores } from '../types'

const CHAVE = 'diagnostico-rascunho'

/**
 * Campos que NAO vao para o rascunho.
 *
 * Eles guardam o nome do arquivo escolhido, e arquivo nao sobrevive ao
 * localStorage. Salvar isto faria o rascunho voltar dizendo "Anexado" com o
 * arquivo perdido, e a etapa passaria a validacao com nada para subir — o
 * monolito tinha exatamente esse furo.
 */
const NAO_PERSISTIDOS = ['anexoSituacaoFiscal', 'anexoCDAs'] as const

type Rascunho = {
  valores: Partial<DiagnosticoValores>
  salvoEm: string
}

export const salvarRascunho = (valores: DiagnosticoValores): void => {
  if (typeof window === 'undefined') return

  const persistiveis = { ...valores }
  for (const campo of NAO_PERSISTIDOS) persistiveis[campo] = ''

  try {
    window.localStorage.setItem(
      CHAVE,
      JSON.stringify({
        valores: persistiveis,
        salvoEm: new Date().toISOString(),
      } satisfies Rascunho),
    )
  } catch {
    // Cota cheia ou armazenamento bloqueado (janela privada). Perder o
    // rascunho e aceitavel; derrubar o formulario nao.
  }
}

/**
 * Le o rascunho fazendo merge campo a campo com o estado inicial.
 *
 * O spread raso nao basta: rascunho salvo antes de um campo existir volta sem
 * ele, e `contatoCliente` como `undefined` quebra a tela na primeira
 * renderizacao de quem tinha rascunho salvo. Ja aconteceu em producao.
 */
export const lerRascunho = (): DiagnosticoValores | null => {
  if (typeof window === 'undefined') return null

  try {
    const cru = window.localStorage.getItem(CHAVE)
    if (!cru) return null

    const salvo = (JSON.parse(cru) as Rascunho | null)?.valores ?? {}
    const base = valoresIniciais()

    return {
      ...base,
      ...salvo,
      contatoCliente: { ...contatoVazio(), ...(salvo.contatoCliente ?? {}) },
      contatoParceiro: { ...contatoVazio(), ...(salvo.contatoParceiro ?? {}) },
      anexoSituacaoFiscal: '',
      anexoCDAs: '',
    }
  } catch {
    return null
  }
}

export const apagarRascunho = (): void => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(CHAVE)
  } catch {
    /* idem */
  }
}
