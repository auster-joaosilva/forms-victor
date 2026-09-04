import estilos from './card.module.css'

import type { ReactNode } from 'react'

export function Card({ children }: { children: ReactNode }) {
  return <section className={estilos.cartao}>{children}</section>
}

/** Aviso em caixa. `tom` decide a cor: informacao, erro ou sucesso. */
export function Callout({
  tom = 'info',
  children,
}: {
  tom?: 'info' | 'erro' | 'sucesso'
  children: ReactNode
}) {
  return (
    <div className={estilos.aviso} data-tom={tom}>
      {children}
    </div>
  )
}
