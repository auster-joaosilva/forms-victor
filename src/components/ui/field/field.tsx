import type { ReactNode } from 'react'

import estilos from './field.module.css'

export type FieldProps = {
  /** Vira `data-field` e liga label -> controle. */
  nome: string
  rotulo: string
  descricao?: string
  obrigatorio?: boolean
  erro?: string
  /** `false` quando o controle e um grupo (radio/checkbox), que usa fieldset. */
  comLabel?: boolean
  children: ReactNode
}

/**
 * Moldura de campo: rotulo, marca de obrigatorio, descricao e erro.
 *
 * Nao sabe nada de dominio — quem sabe o que e CNPJ e a feature. O
 * `data-field` existe para a rolagem-ate-o-primeiro-erro da navegacao.
 */
export function Field({
  nome,
  rotulo,
  descricao,
  obrigatorio,
  erro,
  comLabel = true,
  children,
}: FieldProps) {
  const idDescricao = descricao ? `${nome}-descricao` : undefined
  const idErro = erro ? `${nome}-erro` : undefined

  return (
    <div className={estilos.campo} data-field={nome} data-invalid={Boolean(erro)}>
      {comLabel ? (
        <label className={estilos.rotulo} htmlFor={nome}>
          {rotulo}
          {obrigatorio ? <span className={estilos.marca}>*</span> : null}
        </label>
      ) : (
        <span className={estilos.rotulo}>
          {rotulo}
          {obrigatorio ? <span className={estilos.marca}>*</span> : null}
        </span>
      )}

      {descricao ? (
        <p className={estilos.descricao} id={idDescricao}>
          {descricao}
        </p>
      ) : null}

      <div className={estilos.controle}>{children}</div>

      {erro ? (
        <p className={estilos.erro} id={idErro} role="alert">
          {erro}
        </p>
      ) : null}
    </div>
  )
}
