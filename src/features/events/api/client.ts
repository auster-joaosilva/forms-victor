import type { EventsApi } from '../types/events'

export const eventsApi: EventsApi = {
  lookupCompany: async () => ({ companyName: null }),
  submit: async () => ({ ok: false, error: 'não foi possível inscrever' }),
}
