import { createFileRoute } from '@tanstack/react-router'

import { CascaDiagnostico } from '#/features/diagnostico/components/casca-diagnostico'
import { EtapaCalor } from '#/features/diagnostico/components/etapa-calor'

export const Route = createFileRoute('/diagnostico/calor')({
  component: () => (
    <CascaDiagnostico etapa="calor">
      <EtapaCalor />
    </CascaDiagnostico>
  ),
})
