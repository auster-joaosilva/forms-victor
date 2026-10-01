import type { AdhesionApi } from '../types/adhesion'
import { lookupAdhesionCompany, startNewAdhesion, submitAdhesion } from './adhesion'

export const adhesionApi: AdhesionApi = {
  lookupCompany: (input) => lookupAdhesionCompany({ data: input }),
  submit: (input) => submitAdhesion({ data: input }),
  startNew: () => startNewAdhesion(),
}
