import type { EventsApi } from '../types/events'
import { lookupRegistrationCompany, submitRegistration } from './events'

export const eventsApi: EventsApi = {
  lookupCompany: (input) => lookupRegistrationCompany({ data: input }),
  submit: (input) => submitRegistration({ data: input }),
}
