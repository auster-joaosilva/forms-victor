import { createFileRoute } from '@tanstack/react-router'

import { CascaDiagnostico } from '#/features/diagnostico/components/casca-diagnostico'
import { EtapaAnexos } from '#/features/diagnostico/components/etapa-anexos'

export const Route = createFileRoute('/diagnostico/anexos')({
  component: () => (
    <CascaDiagnostico etapa="anexos">
      <EtapaAnexos />
    </CascaDiagnostico>
  ),
})
