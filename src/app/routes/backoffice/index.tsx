import { Link, createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { BackofficeShell } from '@/components/backoffice/backoffice-shell'
import { LogoutButton } from '@/features/auth/components/logout-button'
import { InvitationsPanel } from '@/features/backoffice-invitations/components/invitations-panel'
import { ResponsesPanel } from '@/features/backoffice-responses/components/responses-panel'
import { RESPONSE_STATUSES } from '@/server/diagnosis/domain/response-status'

const TAB_KEYS = ['responses', 'invitations'] as const
type TabKey = (typeof TAB_KEYS)[number]
const TABS: { key: TabKey; label: string; adminOnly: boolean }[] = [
  { key: 'responses', label: 'Respostas', adminOnly: false },
  { key: 'invitations', label: 'Convites', adminOnly: false },
]

export const Route = createFileRoute('/backoffice/')({
  // The router parses numeric-looking values as numbers (?q=11222333, ?page=2), hence the coercions.
  validateSearch: z.object({
    tab: z.enum(TAB_KEYS).optional().catch(undefined),
    status: z.enum(RESPONSE_STATUSES).optional().catch(undefined),
    q: z.coerce.string().max(200).optional().catch(undefined),
    page: z.coerce.number().int().min(1).optional().catch(undefined),
  }),
  head: () => ({ meta: [{ title: 'Conferência — Diagnóstico Simples | auster' }] }),
  component: BackofficeHome,
})

function BackofficeHome() {
  const { user } = Route.useRouteContext()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const tab = search.tab ?? 'responses'
  const nav = (
    <div className="bo-tabs">
      {TABS.filter((item) => !item.adminOnly || user.role === 'admin').map((item) => (
        <Link key={item.key} to="/backoffice" search={{ tab: item.key }} className={item.key === tab ? 'bo-tab is-active' : 'bo-tab'}>
          {item.label}
        </Link>
      ))}
    </div>
  )
  return (
    <BackofficeShell userName={user.username} nav={nav} logout={<LogoutButton className="bo-logout" />}>
      {tab === 'responses' ? (
        <ResponsesPanel
          key={`${search.status ?? ''}:${search.q ?? ''}`}
          filter={{ status: search.status, q: search.q, page: search.page ?? 1 }}
          onFilterChange={(next) => void navigate({ search: { tab: 'responses', status: next.status, q: next.q, page: next.page } })}
        />
      ) : null}
      {tab === 'invitations' ? <InvitationsPanel /> : null}
    </BackofficeShell>
  )
}
