import { createFileRoute } from '@tanstack/react-router'

import { CascaDiagnostico } from '#/features/diagnostico/components/casca-diagnostico'
import { EtapaRevisao } from '#/features/diagnostico/components/etapa-revisao'

export const Route = createFileRoute('/diagnostico/revisao')({
  component: () => (
    <CascaDiagnostico etapa="revisao">
      <EtapaRevisao />
    </CascaDiagnostico>
  ),
})
