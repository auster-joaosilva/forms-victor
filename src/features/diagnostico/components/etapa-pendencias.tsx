import { ChoiceGroup } from '#/components/ui/choice-group/choice-group'

import { PENDENCIAS, SIM_NAO } from '../config/opcoes'
import { useDiagnostico } from '../stores/diagnostico-store'

import estilos from './etapa.module.css'

export function EtapaPendencias() {
  const { valores, erros, atualizar } = useDiagnostico()

  return (
    <div className={estilos.pilha}>
      <ChoiceGroup
        nome="pendenciaFiscal"
        rotulo="A empresa apresenta alguma pendência ou procedimento fiscal em andamento?"
        obrigatorio
        opcoes={SIM_NAO}
        valor={valores.pendenciaFiscal}
        erro={erros.pendenciaFiscal}
        onChange={(v) => {
          atualizar('pendenciaFiscal', v)
          if (v === 'nao') atualizar('quaisPendencias', [])
        }}
      />

      {valores.pendenciaFiscal === 'sim' ? (
        <ChoiceGroup
          multiplo
          nome="quaisPendencias"
          rotulo="Quais pendências ou procedimentos?"
          descricao="Marque quantas opções achar necessário."
          obrigatorio
          opcoes={PENDENCIAS}
          valor={valores.quaisPendencias}
          erro={erros.quaisPendencias}
          onChange={(v) => atualizar('quaisPendencias', v)}
        />
      ) : null}
    </div>
  )
}
