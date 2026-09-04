import { Select } from '#/components/ui/select/select'
import { TextInput } from '#/components/ui/text-input/text-input'

import { PAPEIS_CONTATO } from '../config/opcoes'
import { formatarTelefone } from '../utils/telefone'

import estilos from './contato-com-papel.module.css'

import type { ContatoPublico } from '../types'

/**
 * Um contato com papel: quem e a pessoa e como se fala com ela.
 *
 * O cadastro do cliente guarda contato COM PAPEL e COM LADO — o socio que
 * decide, o financeiro que paga, o parceiro que indicou. Este formulario e a
 * primeira porta por onde esse dado entra, e antes pedia um contato so,
 * achatado.
 */
export function ContatoComPapel({
  titulo,
  descricao,
  prefixo,
  valor,
  onChange,
}: {
  titulo: string
  descricao: string
  prefixo: string
  valor: ContatoPublico
  onChange: (campo: keyof ContatoPublico, valor: string) => void
}) {
  return (
    <fieldset className={estilos.bloco}>
      <legend className={estilos.legenda}>{titulo}</legend>
      <p className={estilos.descricao}>{descricao}</p>

      <div className={estilos.campos}>
        <TextInput
          nome={`${prefixo}_nome`}
          rotulo="Nome"
          valor={valor.nome}
          onChange={(v) => onChange('nome', v)}
        />
        <Select
          nome={`${prefixo}_papel`}
          rotulo="Papel"
          valor={valor.papel}
          opcoes={PAPEIS_CONTATO}
          onChange={(v) => onChange('papel', v)}
        />
        <TextInput
          nome={`${prefixo}_telefone`}
          rotulo="Telefone"
          tipo="tel"
          inputMode="tel"
          placeholder="(11) 99999-9999"
          valor={valor.telefone}
          onChange={(v) => onChange('telefone', formatarTelefone(v))}
        />
        <TextInput
          nome={`${prefixo}_email`}
          rotulo="E-mail"
          tipo="email"
          inputMode="email"
          valor={valor.email}
          onChange={(v) => onChange('email', v)}
        />
      </div>
    </fieldset>
  )
}
