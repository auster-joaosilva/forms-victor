export const RESPONSE_STATUSES = ['new', 'in_review', 'validated', 'discarded'] as const

export type ResponseStatus = (typeof RESPONSE_STATUSES)[number]

export const RESPONSE_STATUS_LABELS: Record<ResponseStatus, string> = {
  new: 'Nova',
  in_review: 'Em análise',
  validated: 'Validada',
  discarded: 'Descartada',
}

export const isResponseStatus = (value: unknown): value is ResponseStatus =>
  typeof value === 'string' && (RESPONSE_STATUSES as readonly string[]).includes(value)
