import estilos from './button.module.css'

import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: 'primario' | 'destaque' | 'contorno' | 'sutil' | 'sucesso'
  children: ReactNode
}

export function Button({
  variante = 'primario',
  type = 'button',
  children,
  ...resto
}: ButtonProps) {
  return (
    <button
      className={estilos.botao}
      data-variante={variante}
      type={type}
      {...resto}
    >
      {children}
    </button>
  )
}
