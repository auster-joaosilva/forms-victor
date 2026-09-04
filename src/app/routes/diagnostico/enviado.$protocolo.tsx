import { createFileRoute } from '@tanstack/react-router'

import { Comprovante } from '#/features/diagnostico/components/comprovante'

export const Route = createFileRoute('/diagnostico/enviado/$protocolo')({
  component: TelaEnviado,
})

function TelaEnviado() {
  const { protocolo } = Route.useParams()
  return <Comprovante protocolo={protocolo} />
}
