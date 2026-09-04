import { Button } from '#/components/ui/button/button'

import { ETAPA_REVISAO, etapaAnterior, etapaSeguinte } from '../config/etapas'

import estilos from './navegacao-etapa.module.css'

import type { SlugEtapa } from '../config/etapas'

/**
 * Voltar / Proximo / Enviar.
 *
 * O rotulo do botao de avanco muda na penultima etapa ("Revisar") porque
 * chegar na revisao sem saber que era a revisao faz a pessoa achar que
 * enviou.
 */
export function NavegacaoEtapa({
  etapa,
  enviando,
  onVoltar,
}: {
  etapa: SlugEtapa
  enviando: boolean
  onVoltar: () => void
}) {
  const seguinte = etapaSeguinte(etapa)
  const naRevisao = etapa === ETAPA_REVISAO

  return (
    <div className={estilos.navegacao}>
      <Button
        variante="contorno"
        onClick={onVoltar}
        disabled={!etapaAnterior(etapa) || enviando}
      >
        Voltar
      </Button>

      {naRevisao ? (
        <Button type="submit" variante="sucesso" disabled={enviando}>
          {enviando ? 'Enviando…' : 'Enviar solicitação'}
        </Button>
      ) : (
        <Button type="submit" variante="destaque">
          {seguinte === ETAPA_REVISAO ? 'Revisar' : 'Próximo'}
        </Button>
      )}
    </div>
  )
}
