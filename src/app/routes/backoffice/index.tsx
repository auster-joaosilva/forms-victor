import { createFileRoute } from '@tanstack/react-router'
import { LogoutButton } from '@/features/auth/components/logout-button'

export const Route = createFileRoute('/backoffice/')({ component: BackofficeHome })

function BackofficeHome() {
  const { user } = Route.useRouteContext()
  return (
    <main className="mx-auto max-w-[1180px] px-6 py-10">
      <h1 className="text-[21px] font-normal text-auster-dark">Conferência</h1>
      <p className="mt-2 text-sm text-auster-gray">
        Olá, {user.name}. As áreas do backoffice entram na etapa 4.
      </p>
      <LogoutButton className="mt-6 inline-block cursor-pointer text-sm text-auster-accent underline" />
    </main>
  )
}
