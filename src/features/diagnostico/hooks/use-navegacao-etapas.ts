import { useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'

import { ROTAS_ETAPA } from '#/config/paths'

import {
  etapaAnterior,
  etapaSeguinte,
  indiceDaEtapa,
} from '../config/etapas'
import { useDiagnostico } from '../stores/diagnostico-store'

import type { SlugEtapa } from '../config/etapas'

/**
 * `satisfies` faz duas coisas de uma vez: cobra que toda etapa de `ETAPAS`
 * tenha rota (etapa nova sem arquivo de rota reprova o typecheck em vez de dar
 * 404 em producao) e preserva os literais, que e o que o `to` do roteador
 * exige.
 */
const rotas = ROTAS_ETAPA satisfies Record<SlugEtapa, string>

/**
 * Rola ate o primeiro campo invalido e foca nele.
 *
 * Sem isto, numa etapa longa a mensagem nasce fora da tela e o botao
 * "Proximo" parece nao ter feito nada. O `data-invalid` vem do `<Field>`.
 */
const irAteOErro = () => {
  if (typeof document === 'undefined') return

  window.setTimeout(() => {
    const alvo = document.querySelector<HTMLElement>('[data-invalid="true"]')
    alvo?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    alvo
      ?.querySelector<HTMLElement>(
        "input, select, textarea, button, [tabindex]:not([tabindex='-1'])",
      )
      ?.focus?.()
  }, 50)
}

/**
 * A regra de navegacao: voltar e livre, avancar valida.
 *
 * Pular para uma etapa adiante revalida todas as anteriores e para na primeira
 * que falhar — nao da para chegar na revisao por cima de uma etapa vazia.
 */
export const useNavegacaoEtapas = (atual: SlugEtapa) => {
  const navigate = useNavigate()
  const { validarEtapa, primeiraEtapaInvalidaAntesDe, definirErros } =
    useDiagnostico()

  const ir = useCallback(
    (destino: SlugEtapa) => {
      void navigate({ to: rotas[destino] })
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    },
    [navigate],
  )

  const voltar = useCallback(() => {
    const anterior = etapaAnterior(atual)
    if (!anterior) return
    definirErros({})
    ir(anterior)
  }, [atual, definirErros, ir])

  /** `false` quando a etapa atual nao passou — os erros ja estao na tela. */
  const avancar = useCallback((): boolean => {
    const seguinte = etapaSeguinte(atual)
    if (!seguinte) return false

    if (!validarEtapa(atual)) {
      irAteOErro()
      return false
    }

    ir(seguinte)
    return true
  }, [atual, ir, validarEtapa])

  /**
   * Clique na barra de etapas. Devolve a etapa que barrou a passagem, ou
   * `null` quando a navegacao aconteceu.
   */
  const irPara = useCallback(
    (destino: SlugEtapa): SlugEtapa | null => {
      if (destino === atual) return null

      if (indiceDaEtapa(destino) < indiceDaEtapa(atual)) {
        definirErros({})
        ir(destino)
        return null
      }

      const invalida = primeiraEtapaInvalidaAntesDe(destino)
      if (invalida) {
        ir(invalida)
        irAteOErro()
        return invalida
      }

      ir(destino)
      return null
    },
    [atual, definirErros, ir, primeiraEtapaInvalidaAntesDe],
  )

  return { ir, irPara, voltar, avancar }
}
