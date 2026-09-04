import { createFileRoute } from '@tanstack/react-router'

import { CascaDiagnostico } from '#/features/diagnostico/components/casca-diagnostico'
import { EtapaPendencias } from '#/features/diagnostico/components/etapa-pendencias'

export const Route = createFileRoute('/diagnostico/pendencias')({
  component: () => (
    <CascaDiagnostico etapa="pendencias">
      <EtapaPendencias />
    </CascaDiagnostico>
  ),
})
