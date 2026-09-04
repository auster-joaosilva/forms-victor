import { createFileRoute } from '@tanstack/react-router'

import { CascaDiagnostico } from '#/features/diagnostico/components/casca-diagnostico'
import { EtapaRiscos } from '#/features/diagnostico/components/etapa-riscos'

export const Route = createFileRoute('/diagnostico/riscos')({
  component: () => (
    <CascaDiagnostico etapa="riscos">
      <EtapaRiscos />
    </CascaDiagnostico>
  ),
})
