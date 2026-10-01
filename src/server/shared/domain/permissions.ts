// Fonte: origin/main src/papeis.mjs (10f5a4c). Os quatro papéis foram decididos pelo Victor em 01/10/2026.
// A capacidade nomeia o que se FAZ, não a aba onde se clica: a aba muda de nome, a capacidade não.
export const ROLES = ['admin', 'manager', 'regularization', 'operator'] as const
export type Role = (typeof ROLES)[number]

// O mais fechado dos quatro: papel corrompido ou vindo de versão antiga não vira passe livre.
export const DEFAULT_ROLE: Role = 'operator'

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'administrador',
  manager: 'gestor de departamento',
  regularization: 'regularização',
  operator: 'operador',
}

export const CAPABILITIES = [
  'dashboard', 'own_access',
  'view_responses', 'handle_responses', 'export_responses',
  'view_adhesions', 'handle_adhesions', 'export_adhesions', 'reprint_term',
  'view_invitations', 'manage_invitations',
  'view_events', 'manage_events', 'handle_registrations', 'export_registrations',
  'view_audit',
  'manage_users',
] as const
export type Capability = (typeof CAPABILITIES)[number]

const COMMON: readonly Capability[] = ['dashboard', 'own_access']

export const ROLE_CAPABILITIES: Record<Role, readonly Capability[]> = {
  admin: CAPABILITIES,
  manager: CAPABILITIES.filter((capability) => capability !== 'manage_users'),
  // Planilha com CPF e CNPJ e a trilha de auditoria sobem para a chefia, por decisão do Victor.
  regularization: [...COMMON, 'view_responses', 'handle_responses', 'view_adhesions', 'handle_adhesions', 'reprint_term'],
  operator: [...COMMON, 'view_responses', 'handle_responses', 'view_invitations', 'manage_invitations', 'view_events', 'manage_events', 'handle_registrations'],
}

export const toRole = (value: unknown): Role => (ROLES as readonly unknown[]).includes(value) ? (value as Role) : DEFAULT_ROLE

export const capabilitiesOf = (role: Role): readonly Capability[] => ROLE_CAPABILITIES[role]

export const can = (role: Role, capability: Capability): boolean => ROLE_CAPABILITIES[role].includes(capability)
