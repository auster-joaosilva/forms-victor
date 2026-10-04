import type { HomeBootstrap } from '../types/home'
import { longDate } from './long-date'

const ICONS = {
  diagnosis: (
    <path d="M4 20V9m5 11V4m5 16v-7m5 7V7" />
  ),
  term: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5M9 14h6M9 17h4" />
    </>
  ),
  events: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  talk: <path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12Z" />,
} as const

interface Door {
  href: string
  icon: keyof typeof ICONS
  title: string
  text: string
  go: string
  closed: boolean
}

// A porta dos encontros muda conforme a agenda: prometer "encontros" sem nenhum marcado é cartaz velho.
function eventsDoor(events: HomeBootstrap['events']): Pick<Door, 'text' | 'go' | 'closed'> {
  if (events.kind === 'none') {
    return { text: 'Nenhum encontro marcado no momento. Quando a próxima data sair, ela aparece aqui primeiro.', go: 'Ver a agenda →', closed: true }
  }
  const when = events.date ? longDate(events.date) : ''
  const tail = events.openCount > 1 ? `Há ${events.openCount} encontros abertos.` : 'Inscrição gratuita.'
  return { text: `${events.title}${when ? ` — ${when}` : ''}. ${tail}`, go: 'Quero me inscrever →', closed: false }
}

function termDoor(window: HomeBootstrap['adhesionWindow']): Pick<Door, 'text' | 'go' | 'closed'> {
  if (window === 'closed') {
    return { text: 'A janela de opção está encerrada. Fale com a Auster para saber quando a próxima abre e o que fazer até lá.', go: 'Encerrado por ora', closed: true }
  }
  return {
    text: 'Decidido o caminho, formalize por escrito. O termo é assinado na própria página e fica registrado com data, hora e origem do aceite.',
    go: 'Assinar o termo →',
    closed: false,
  }
}

export function Doors({ bootstrap }: { bootstrap: HomeBootstrap }) {
  const doors: Door[] = [
    {
      href: '/diagnosis',
      icon: 'diagnosis',
      title: 'Diagnóstico',
      text: 'Responda o questionário e descubra se a sua empresa do Simples Nacional deve recolher IBS e CBS dentro da guia única ou por fora dela.',
      go: 'Começar o diagnóstico →',
      closed: false,
    },
    { href: '/adhesion', icon: 'term', title: 'Termo de opção', ...termDoor(bootstrap.adhesionWindow) },
    { href: '/events', icon: 'events', title: 'Encontros', ...eventsDoor(bootstrap.events) },
    {
      href: 'mailto:contato@austercontabil.com.br',
      icon: 'talk',
      title: 'Falar com a Auster',
      text: 'Caso fora do padrão, dúvida que o formulário não cobre ou empresa que já é cliente da casa: escreva direto para a equipe.',
      go: 'Escrever para a equipe →',
      closed: false,
    },
  ]
  return (
    <div className="portas" id="portas-lista">
      {doors.map((door) => (
        <a key={door.title} className={door.closed ? 'porta fechada' : 'porta'} href={door.href}>
          <div className="icone">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              {ICONS[door.icon]}
            </svg>
          </div>
          <h3>{door.title}</h3>
          <div className="d">{door.text}</div>
          <div className="ir">{door.go}</div>
        </a>
      ))}
    </div>
  )
}
