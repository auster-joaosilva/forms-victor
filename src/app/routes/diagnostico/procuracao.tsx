import { createFileRoute } from '@tanstack/react-router'

import { CascaDiagnostico } from '#/features/diagnostico/components/casca-diagnostico'
import { EtapaProcuracao } from '#/features/diagnostico/components/etapa-procuracao'

export const Route = createFileRoute('/diagnostico/procuracao')({
  component: () => (
    <CascaDiagnostico etapa="procuracao">
      <EtapaProcuracao />
    </CascaDiagnostico>
  ),
})
