import { ChoiceGroup } from '#/components/ui/choice-group/choice-group'

import { RISCOS, SIM_NAO } from '../config/opcoes'
import { useDiagnostico } from '../stores/diagnostico-store'

import estilos from './etapa.module.css'

/**
 * Risco imediato NAO e so informacao: junto com a onda de calor ele decide a
 * prioridade e o prazo de retorno. Ver `utils/prazo.ts`.
 */
export function EtapaRiscos() {
  const { valores, erros, atualizar } = useDiagnostico()

  return (
    <div className={estilos.pilha}>
      <ChoiceGroup
        nome="riscoImediato"
        rotulo="Existe risco imediato para a empresa?"
        obrigatorio
        opcoes={SIM_NAO}
        valor={valores.riscoImediato}
        erro={erros.riscoImediato}
        onChange={(v) => {
          atualizar('riscoImediato', v)
          if (v === 'nao') atualizar('quaisRiscos', [])
        }}
      />

      {valores.riscoImediato === 'sim' ? (
        <ChoiceGroup
          multiplo
          nome="quaisRiscos"
          rotulo="Quais riscos?"
          obrigatorio
          opcoes={RISCOS}
          valor={valores.quaisRiscos}
          erro={erros.quaisRiscos}
          onChange={(v) => atualizar('quaisRiscos', v)}
        />
      ) : null}
    </div>
  )
}
