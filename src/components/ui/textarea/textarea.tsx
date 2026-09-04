import { Field } from '#/components/ui/field/field'

import estilos from './textarea.module.css'

import type { FieldProps } from '#/components/ui/field/field'

type TextareaProps = Omit<FieldProps, 'children' | 'comLabel'> & {
  valor: string
  onChange: (valor: string) => void
  placeholder?: string
  linhas?: number
}

export function Textarea({
  valor,
  onChange,
  placeholder,
  linhas = 5,
  ...campo
}: TextareaProps) {
  return (
    <Field {...campo}>
      <textarea
        className={estilos.area}
        id={campo.nome}
        name={campo.nome}
        rows={linhas}
        value={valor}
        placeholder={placeholder}
        aria-invalid={Boolean(campo.erro)}
        onChange={(evento) => onChange(evento.target.value)}
      />
    </Field>
  )
}
