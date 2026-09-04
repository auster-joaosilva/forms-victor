import { ChoiceGroup } from '#/components/ui/choice-group/choice-group'

import { FORMAS_ACESSO, SIM_NAO } from '../config/opcoes'
import { useDiagnostico } from '../stores/diagnostico-store'

import estilos from './etapa.module.css'

export function EtapaProcuracao() {
  const { valores, erros, atualizar } = useDiagnostico()

  return (
    <div className={estilos.pilha}>
      <ChoiceGroup
        nome="procuracaoFeita"
        rotulo="A procuração já foi feita?"
        descricao="É necessária procuração ativa para o diagnóstico."
        obrigatorio
        opcoes={SIM_NAO}
        valor={valores.procuracaoFeita}
        erro={erros.procuracaoFeita}
        onChange={(v) => {
          atualizar('procuracaoFeita', v)
          // Procuração feita não usa forma de acesso: deixar o valor antigo
          // mandaria "VPN" junto de "procuração ativa" e confundiria a
          // triagem.
          if (v === 'sim') atualizar('formaAcesso', '')
        }}
      />

      {valores.procuracaoFeita === 'nao' ? (
        <ChoiceGroup
          nome="formaAcesso"
          rotulo="Qual a forma de acesso às informações?"
          obrigatorio
          opcoes={FORMAS_ACESSO}
          valor={valores.formaAcesso}
          erro={erros.formaAcesso}
          onChange={(v) => atualizar('formaAcesso', v)}
        />
      ) : null}
    </div>
  )
}
