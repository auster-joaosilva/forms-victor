import { ChoiceGroup } from '#/components/ui/choice-group/choice-group'
import { TextInput } from '#/components/ui/text-input/text-input'

import { CONTATO_WHATSAPP, TRATATIVAS } from '../config/opcoes'
import { useDiagnostico } from '../stores/diagnostico-store'
import { formatarCpfCnpj } from '../utils/cpf-cnpj'
import { formatarTelefone } from '../utils/telefone'
import { ContatoComPapel } from './contato-com-papel'

import estilos from './etapa.module.css'

export function EtapaIdentificacao() {
  const { valores, erros, atualizar, atualizarContato } = useDiagnostico()

  return (
    <div className={estilos.pilha}>
      <TextInput
        nome="email"
        rotulo="E-mail"
        tipo="email"
        inputMode="email"
        obrigatorio
        valor={valores.email}
        erro={erros.email}
        onChange={(v) => atualizar('email', v)}
      />

      <TextInput
        nome="nomeSolicitante"
        rotulo="Nome do solicitante"
        descricao="Quem está solicitando o diagnóstico."
        obrigatorio
        valor={valores.nomeSolicitante}
        erro={erros.nomeSolicitante}
        onChange={(v) => atualizar('nomeSolicitante', v)}
      />

      <TextInput
        nome="escritorioParceiro"
        rotulo="Escritório parceiro Auster"
        obrigatorio
        valor={valores.escritorioParceiro}
        erro={erros.escritorioParceiro}
        onChange={(v) => atualizar('escritorioParceiro', v)}
      />

      <TextInput
        nome="nomeContribuinte"
        rotulo="Nome do contribuinte"
        descricao="Cliente para o qual será feito o diagnóstico."
        obrigatorio
        valor={valores.nomeContribuinte}
        erro={erros.nomeContribuinte}
        onChange={(v) => atualizar('nomeContribuinte', v)}
      />

      <TextInput
        nome="cnpjCpf"
        rotulo="CNPJ ou CPF do contribuinte"
        descricao="Em caso de grupo econômico, informe aqui o principal e os demais nas informações adicionais."
        placeholder="000.000.000-00"
        inputMode="numeric"
        obrigatorio
        valor={valores.cnpjCpf}
        erro={erros.cnpjCpf}
        onChange={(v) => atualizar('cnpjCpf', formatarCpfCnpj(v))}
      />

      {/* Grupo de WhatsApp OU telefone. Trocar a resposta limpa o outro
          campo, senao os dois viajam no envio e a triagem nao sabe qual
          usar. */}
      <ChoiceGroup
        nome="possuiGrupoWhatsapp"
        rotulo="Telefone de contato"
        descricao="Contato de quem irá tratar os assuntos do diagnóstico. Possui grupo no WhatsApp para comunicação?"
        obrigatorio
        opcoes={CONTATO_WHATSAPP}
        valor={valores.possuiGrupoWhatsapp}
        erro={erros.possuiGrupoWhatsapp}
        onChange={(v) => {
          atualizar('possuiGrupoWhatsapp', v)
          if (v === 'sim') atualizar('telefone', '')
          if (v === 'nao') atualizar('nomeGrupoWhatsapp', '')
        }}
      />

      {valores.possuiGrupoWhatsapp === 'sim' ? (
        <TextInput
          nome="nomeGrupoWhatsapp"
          rotulo="Nome do grupo no WhatsApp"
          placeholder="Ex.: Grupo Diagnóstico — Empresa X"
          obrigatorio
          valor={valores.nomeGrupoWhatsapp}
          erro={erros.nomeGrupoWhatsapp}
          onChange={(v) => atualizar('nomeGrupoWhatsapp', v)}
        />
      ) : null}

      {valores.possuiGrupoWhatsapp === 'nao' ? (
        <TextInput
          nome="telefone"
          rotulo="Número de telefone"
          descricao="Celular ou fixo com DDD."
          tipo="tel"
          inputMode="tel"
          placeholder="(11) 99999-9999"
          obrigatorio
          valor={valores.telefone}
          erro={erros.telefone}
          onChange={(v) => atualizar('telefone', formatarTelefone(v))}
        />
      ) : null}

      <div className={estilos.bloco} data-field="contatos" data-invalid={Boolean(erros.contatos)}>
        <div>
          <h2 className={estilos.subtitulo}>Contatos do atendimento</h2>
          <p className={estilos.apoio}>
            Com quem falamos quando o assunto for esta empresa. Preencha o que
            souber — <strong>pelo menos um dos dois</strong> é necessário.
          </p>
          {erros.contatos ? (
            <p className={estilos.erro} role="alert">
              {erros.contatos}
            </p>
          ) : null}
        </div>

        <ContatoComPapel
          titulo="Do lado do cliente"
          descricao="Quem responde pela empresa no dia a dia."
          prefixo="contato_cliente"
          valor={valores.contatoCliente}
          onChange={(campo, v) => atualizarContato('contatoCliente', campo, v)}
        />

        <ContatoComPapel
          titulo="Do lado do parceiro"
          descricao="Quem acompanha o caso no escritório que indicou."
          prefixo="contato_parceiro"
          valor={valores.contatoParceiro}
          onChange={(campo, v) => atualizarContato('contatoParceiro', campo, v)}
        />
      </div>

      <ChoiceGroup
        nome="tratativa"
        rotulo="Como o serviço deve ser tratado?"
        descricao="Se a validação passa pelo parceiro, ninguém combina prazo ou condição direto com o cliente."
        obrigatorio
        opcoes={TRATATIVAS}
        valor={valores.tratativa}
        erro={erros.tratativa}
        onChange={(v) => atualizar('tratativa', v)}
      />
    </div>
  )
}
