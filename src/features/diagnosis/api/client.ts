import type { DiagnosisApi } from '../types/diagnosis'
import { discardDraft, lookupCnpj, saveDraft, submitDiagnosis } from './diagnosis'

export const diagnosisApi: DiagnosisApi = {
  saveDraft: (input) => saveDraft({ data: input }),
  discardDraft: () => discardDraft(),
  lookupCnpj: (input) => lookupCnpj({ data: input }),
  submitDiagnosis: () => submitDiagnosis(),
}
