import { ChoiceGroup } from '#/components/ui/choice-group/choice-group'

import { ONDAS_CALOR } from '../config/opcoes'
import { useDiagnostico } from '../stores/diagnostico-store'

import estilos from './etapa.module.css'

/**
 * "Muito interessado" com risco imediato e o caso de 4 horas uteis. A
 * resposta desta etapa vale prazo — ver `utils/prazo.ts`.
 */
export function EtapaCalor() {
  const { valores, erros, atualizar } = useDiagnostico()

  return (
    <div className={estilos.pilha}>
      <ChoiceGroup
        nome="ondaCalor"
        rotulo="Onda de calor do cliente"
        descricao="Qual o nível de interesse do cliente na transação tributária?"
        obrigatorio
        opcoes={ONDAS_CALOR}
        valor={valores.ondaCalor}
        erro={erros.ondaCalor}
        onChange={(v) => atualizar('ondaCalor', v)}
      />
    </div>
  )
}
