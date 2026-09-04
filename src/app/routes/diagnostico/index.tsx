import { createFileRoute, redirect } from '@tanstack/react-router'

import { ROTAS_ETAPA } from '#/config/paths'

/** /diagnostico nao tem tela propria: entra pela primeira etapa. */
export const Route = createFileRoute('/diagnostico/')({
  beforeLoad: () => {
    throw redirect({ to: ROTAS_ETAPA.identificacao })
  },
})
