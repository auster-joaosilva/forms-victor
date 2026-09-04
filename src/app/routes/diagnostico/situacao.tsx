import { createFileRoute } from '@tanstack/react-router'

import { CascaDiagnostico } from '#/features/diagnostico/components/casca-diagnostico'
import { EtapaSituacao } from '#/features/diagnostico/components/etapa-situacao'

export const Route = createFileRoute('/diagnostico/situacao')({
  component: () => (
    <CascaDiagnostico etapa="situacao">
      <EtapaSituacao />
    </CascaDiagnostico>
  ),
})
