import { Field } from '#/components/ui/field/field'

import estilos from './text-input.module.css'

import type { FieldProps } from '#/components/ui/field/field'

type TextInputProps = Omit<FieldProps, 'children' | 'comLabel'> & {
  valor: string
  onChange: (valor: string) => void
  tipo?: 'text' | 'email' | 'tel'
  placeholder?: string
  inputMode?: 'text' | 'email' | 'tel' | 'numeric'
  autoComplete?: string
}

export function TextInput({
  valor,
  onChange,
  tipo = 'text',
  placeholder,
  inputMode,
  autoComplete,
  ...campo
}: TextInputProps) {
  return (
    <Field {...campo}>
      <input
        className={estilos.entrada}
        id={campo.nome}
        name={campo.nome}
        type={tipo}
        value={valor}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete={autoComplete}
        aria-invalid={Boolean(campo.erro)}
        aria-describedby={campo.erro ? `${campo.nome}-erro` : undefined}
        onChange={(evento) => onChange(evento.target.value)}
      />
    </Field>
  )
}
