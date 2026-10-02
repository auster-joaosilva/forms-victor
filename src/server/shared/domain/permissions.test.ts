import { describe, expect, it } from 'vitest'
import { CAPABILITIES, DEFAULT_ROLE, ROLES, ROLE_CAPABILITIES, ROLE_LABELS, can, capabilitiesOf, toRole } from './permissions'

// Cópia em inglês de origin/main:src/papeis.mjs (10f5a4c, papéis decididos pelo Victor em 01/10/2026).
const COMMON = ['dashboard', 'own_access']
const EXPECTED: Record<string, string[]> = {
  admin: [...CAPABILITIES],
  manager: CAPABILITIES.filter((capability) => capability !== 'manage_users'),
  regularization: [...COMMON, 'view_responses', 'handle_responses', 'view_adhesions', 'handle_adhesions', 'reprint_term'],
  operator: [...COMMON, 'view_responses', 'handle_responses', 'view_invitations', 'manage_invitations', 'view_events', 'manage_events', 'handle_registrations'],
}

describe('permissions', () => {
  it('has the four roles and their labels', () => {
    expect(ROLES).toEqual(['admin', 'manager', 'regularization', 'operator'])
    expect(ROLE_LABELS).toEqual({ admin: 'administrador', manager: 'gestor de departamento', regularization: 'regularização', operator: 'operador' })
  })

  it('lists the seventeen capabilities of the old table', () => {
    expect(CAPABILITIES).toEqual([
      'dashboard', 'own_access',
      'view_responses', 'handle_responses', 'export_responses',
      'view_adhesions', 'handle_adhesions', 'export_adhesions', 'reprint_term',
      'view_invitations', 'manage_invitations',
      'view_events', 'manage_events', 'handle_registrations', 'export_registrations',
      'view_audit',
      'manage_users',
    ])
  })

  it('mirrors the capability table of papeis.mjs', () => {
    for (const role of ROLES) expect([...ROLE_CAPABILITIES[role]].sort()).toEqual([...(EXPECTED[role] ?? [])].sort())
  })

  it('keeps spreadsheets and the audit trail with admin and manager only', () => {
    for (const capability of ['export_responses', 'export_adhesions', 'export_registrations', 'view_audit'] as const) {
      expect(ROLES.filter((role) => can(role, capability))).toEqual(['admin', 'manager'])
    }
    expect(can('operator', 'view_adhesions')).toBe(false)
    expect(can('regularization', 'reprint_term')).toBe(true)
    expect(ROLES.filter((role) => can(role, 'manage_users'))).toEqual(['admin'])
  })

  it('turns an unknown role into the most closed one', () => {
    expect(DEFAULT_ROLE).toBe('operator')
    expect(toRole('team')).toBe('operator')
    expect(toRole('equipe')).toBe('operator')
    expect(toRole(undefined)).toBe('operator')
    expect(toRole('manager')).toBe('manager')
    expect(capabilitiesOf(toRole('qualquer'))).toBe(ROLE_CAPABILITIES.operator)
  })
})
