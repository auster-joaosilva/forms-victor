import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: HomePage })

function HomePage() {
  return (
    <main className="mx-auto max-w-[820px] px-6 py-16">
      <h1 className="text-[28px] font-normal text-auster-dark">Auster Inteligência Contábil</h1>
      <p className="mt-2 text-sm text-auster-gray">Ambiente de homologação.</p>
    </main>
  )
}
