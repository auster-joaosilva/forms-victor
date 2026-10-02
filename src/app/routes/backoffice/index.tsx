import { Link, createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { BackofficeShell } from '@/components/backoffice/backoffice-shell'
import { LogoutButton } from '@/features/auth/components/logout-button'
import { AuditPanel } from '@/features/backoffice-audit/components/audit-panel'
import { AdhesionsPanel } from '@/features/backoffice-adhesions/components/adhesions-panel'
import { InvitationsPanel } from '@/features/backoffice-invitations/components/invitations-panel'
import { MigrationPanel } from '@/features/backoffice-migration/components/migration-panel'
import { ResponsesPanel } from '@/features/backoffice-responses/components/responses-panel'
import { OwnPasswordButton } from '@/features/backoffice-users/components/own-password-button'
import { UsersPanel } from '@/features/backoffice-users/components/users-panel'
import { ADHESION_STATUSES } from '@/server/adhesion/domain/adhesion'
import { RESPONSE_STATUSES } from '@/server/diagnosis/domain/response-status'
import type { Capability } from '@/server/shared/domain/permissions'

const TAB_KEYS = ['responses', 'adhesions', 'invitations', 'audit', 'users', 'migration'] as const
type TabKey = (typeof TAB_KEYS)[number]
// A tela só esconde; quem fecha é o requireCapability de cada server function.
const TABS: { key: TabKey; label: string; capability: Capability }[] = [
  { key: 'responses', label: 'Respostas', capability: 'view_responses' },
  { key: 'adhesions', label: 'Adesões', capability: 'view_adhesions' },
  { key: 'invitations', label: 'Convites', capability: 'view_invitations' },
  { key: 'audit', label: 'Auditoria', capability: 'view_audit' },
  { key: 'users', label: 'Usuários', capability: 'manage_users' },
  { key: 'migration', label: 'Migração', capability: 'manage_users' },
]

export const Route = createFileRoute('/backoffice/')({
  // The router parses numeric-looking values as numbers (?q=11222333, ?page=2), hence the coercions.
  validateSearch: z.object({
    tab: z.enum(TAB_KEYS).optional().catch(undefined),
    status: z.enum(RESPONSE_STATUSES).optional().catch(undefined),
    adhesionStatus: z.enum(ADHESION_STATUSES).optional().catch(undefined),
    modality: z.enum(['padrao', 'hibrido']).optional().catch(undefined),
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
  const allowed = TABS.filter((item) => user.capabilities.includes(item.capability))
  const tab = allowed.some((item) => item.key === search.tab) ? search.tab : allowed[0]?.key
  const nav = (
    <div className="bo-tabs">
      {allowed.map((item) => (
        <Link key={item.key} to="/backoffice" search={{ tab: item.key }} className={item.key === tab ? 'bo-tab is-active' : 'bo-tab'}>
          {item.label}
        </Link>
      ))}
    </div>
  )
  return (
    <BackofficeShell userName={user.username} nav={nav} account={<OwnPasswordButton username={user.username} />} logout={<LogoutButton className="bo-logout" />}>
      {tab === 'responses' ? (
        <ResponsesPanel
          canExport={user.capabilities.includes('export_responses')}
          key={`${search.status ?? ''}:${search.q ?? ''}`}
          filter={{ status: search.status, q: search.q, page: search.page ?? 1 }}
          onFilterChange={(next) => void navigate({ search: { tab: 'responses', status: next.status, q: next.q, page: next.page } })}
        />
      ) : null}
      {tab === 'adhesions' && user.capabilities.includes('view_adhesions') ? (
        <AdhesionsPanel
          key={`${search.adhesionStatus ?? ''}:${search.modality ?? ''}:${search.q ?? ''}`}
          filter={{ status: search.adhesionStatus, modality: search.modality, q: search.q, page: search.page ?? 1 }}
          canExport={user.capabilities.includes('export_adhesions')}
          onFilterChange={(next) =>
            void navigate({ search: { tab: 'adhesions', adhesionStatus: next.status, modality: next.modality, q: next.q, page: next.page } })
          }
        />
      ) : null}
      {tab === 'invitations' ? <InvitationsPanel /> : null}
      {tab === 'audit' ? <AuditPanel /> : null}
      {tab === 'users' ? <UsersPanel /> : null}
      {tab === 'migration' ? <MigrationPanel /> : null}
    </BackofficeShell>
  )
}
