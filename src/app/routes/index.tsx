import { Link, createFileRoute } from '@tanstack/react-router'

import { ROTAS_ETAPA } from '#/config/paths'

import estilos from './index.module.css'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <div className={estilos.area}>
      <div className={estilos.miolo}>
        <p className={estilos.marca}>Auster Inteligência Tributária</p>
        <h1 className={estilos.titulo}>Formulários</h1>
        <p className={estilos.texto}>
          Solicitações da consultoria tributária. Escolha o formulário que
          corresponde ao caso do seu cliente.
        </p>
        <Link className={estilos.acao} to={ROTAS_ETAPA.identificacao}>
          Diagnóstico de transação tributária
        </Link>
      </div>
    </div>
  )
}
