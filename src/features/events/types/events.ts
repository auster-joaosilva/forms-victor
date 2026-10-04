import type { EventSummary, EventView } from '@/server/events/domain/event'

export interface EventsListBootstrap {
  events: EventSummary[]
  today: string
  publicUrl: string
}

export interface EventPageBootstrap {
  event: EventView
  today: string
  publicUrl: string
}

export interface RegistrationBody {
  evento: string
  sessaoId: number
  nome: string
  email: string
  telefone: string
  empresa: string
  cnpj: string
  cargo: string
  aceite: boolean
}

export interface RegistrationReceiptWire {
  protocol: string
  repeated: boolean
  sessionLabel: string
  name: string
  email: string
}

export type SubmitRegistrationWire = { ok: true; receipt: RegistrationReceiptWire } | { ok: false; error: string }

export interface EventsApi {
  lookupCompany(input: { cnpj: string }): Promise<{ companyName: string | null }>
  submit(input: RegistrationBody): Promise<SubmitRegistrationWire>
}
