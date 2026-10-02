export const RESET_CONFIRMATION = 'APAGAR'

export type MigrationErrorReason = 'forbidden' | 'unavailable' | 'busy' | 'reset_disabled' | 'reset_unconfirmed'

const MESSAGES: Record<Exclude<MigrationErrorReason, 'unavailable'>, string> = {
  forbidden: 'só administrador',
  busy: 'já há uma operação de migração em andamento; espere ela terminar',
  reset_disabled: 'apagar dados de teste está desligado neste ambiente',
  reset_unconfirmed: `digite ${RESET_CONFIRMATION} para confirmar`,
}

export class MigrationError extends Error {
  constructor(
    readonly reason: MigrationErrorReason,
    path = '',
  ) {
    super(reason === 'unavailable' ? `o banco do portal antigo não está disponível em ${path}` : MESSAGES[reason])
  }
}
