import { createFileRoute } from '@tanstack/react-router'

import { CascaDiagnostico } from '#/features/diagnostico/components/casca-diagnostico'
import { EtapaIdentificacao } from '#/features/diagnostico/components/etapa-identificacao'

export const Route = createFileRoute('/diagnostico/identificacao')({
  component: () => (
    <CascaDiagnostico etapa="identificacao">
      <EtapaIdentificacao />
    </CascaDiagnostico>
  ),
})
