import { ChoiceGroup } from '#/components/ui/choice-group/choice-group'

import { FAIXAS_VALOR, ORIGENS_DEBITO } from '../config/opcoes'
import { useDiagnostico } from '../stores/diagnostico-store'

import estilos from './etapa.module.css'

export function EtapaSituacao() {
  const { valores, erros, atualizar } = useDiagnostico()

  return (
    <div className={estilos.pilha}>
      <ChoiceGroup
        nome="faturamentoMensal"
        rotulo="Faturamento médio mensal aproximado"
        obrigatorio
        opcoes={FAIXAS_VALOR}
        valor={valores.faturamentoMensal}
        erro={erros.faturamentoMensal}
        onChange={(v) => atualizar('faturamentoMensal', v)}
      />

      <ChoiceGroup
        multiplo
        nome="debitosConcentrados"
        rotulo="Onde estão concentrados os débitos?"
        descricao="Marque quantas opções achar necessário."
        obrigatorio
        opcoes={ORIGENS_DEBITO}
        valor={valores.debitosConcentrados}
        erro={erros.debitosConcentrados}
        onChange={(v) => atualizar('debitosConcentrados', v)}
      />

      <ChoiceGroup
        nome="valorPassivo"
        rotulo="Valor aproximado do passivo tributário total"
        obrigatorio
        opcoes={FAIXAS_VALOR}
        valor={valores.valorPassivo}
        erro={erros.valorPassivo}
        onChange={(v) => atualizar('valorPassivo', v)}
      />
    </div>
  )
}
