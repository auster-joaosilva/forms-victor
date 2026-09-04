import { Outlet, createFileRoute } from '@tanstack/react-router'

import { DiagnosticoProvider } from '#/features/diagnostico/stores/diagnostico-store'

/**
 * Layout do diagnostico. Monta o provedor de estado UMA vez, para o
 * formulario atravessar a troca de rota entre etapas.
 *
 * Sem logica de negocio aqui: quem valida e navega e a feature.
 */
export const Route = createFileRoute('/diagnostico')({
  component: LayoutDiagnostico,
})

function LayoutDiagnostico() {
  return (
    <DiagnosticoProvider>
      <Outlet />
    </DiagnosticoProvider>
  )
}
