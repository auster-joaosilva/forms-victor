import { Field } from '#/components/ui/field/field'

import estilos from './select.module.css'

import type { FieldProps } from '#/components/ui/field/field'
import type { Opcao } from '#/components/ui/types'

type SelectProps = Omit<FieldProps, 'children' | 'comLabel'> & {
  valor: string
  onChange: (valor: string) => void
  opcoes: ReadonlyArray<Opcao>
  placeholder?: string
}

export function Select({
  valor,
  onChange,
  opcoes,
  placeholder = 'Selecione…',
  ...campo
}: SelectProps) {
  return (
    <Field {...campo}>
      <select
        className={estilos.selecao}
        id={campo.nome}
        name={campo.nome}
        value={valor}
        aria-invalid={Boolean(campo.erro)}
        onChange={(evento) => onChange(evento.target.value)}
      >
        <option value="">{placeholder}</option>
        {opcoes.map((opcao) => (
          <option key={opcao.valor} value={opcao.valor}>
            {opcao.rotulo}
          </option>
        ))}
      </select>
    </Field>
  )
}
