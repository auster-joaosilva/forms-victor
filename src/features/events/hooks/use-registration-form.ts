import { useRef, useState } from 'react'
import type { EventView } from '@/server/events/domain/event'
import {
  REGISTRATION_FIELD_ORDER,
  registrationClientErrors,
  type RegistrationField,
  type RegistrationFormState as ClientState,
} from '@/server/events/domain/client-rules'
import { isValidCnpj, maskCnpj } from '@/server/shared/domain/validation'
import { REGISTRATION_FALLBACK } from '../api/guard-submit'
import type { EventsApi, RegistrationReceiptWire } from '../types/events'

export const CNPJ_HINT = 'digite o CNPJ e saia do campo: a razão social vem da Receita'
export const CNPJ_LOOKING = 'consultando…'
export const CNPJ_FAILED = 'não consegui consultar o cadastro agora — escreva a empresa à mão.'
export const MISSING_FIELDS = 'Faltam campos acima.'
export const NETWORK_FAILURE = 'Não foi possível falar com o servidor. Confira a conexão e tente de novo.'

export const errorId = (field: RegistrationField) => `registration-error-${field}`

// O estado da regra da tela mais os dois campos que ela não confere (empresa e cargo).
export type RegistrationFormState = ClientState & { empresa: string; cargo: string }

const empty: RegistrationFormState = { sessaoId: null, nome: '', email: '', telefone: '', empresa: '', cnpj: '', cargo: '', aceite: false }

const refusal = (reason: string) => `Não foi possível inscrever: ${reason}`

export function useRegistrationForm({ api, event }: { api: EventsApi; event: EventView }) {
  const [form, setForm] = useState<RegistrationFormState>(empty)
  const [errors, setErrors] = useState<Partial<Record<RegistrationField, string>>>({})
  const [cnpjNotice, setCnpjNotice] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [sending, setSending] = useState(false)
  const [receipt, setReceipt] = useState<RegistrationReceiptWire | null>(null)
  // O botão só trava quando sending re-renderiza; o segundo clique de um duplo clique chega antes disso.
  const inFlight = useRef(false)

  const set = <K extends keyof RegistrationFormState>(field: K, value: RegistrationFormState[K]) =>
    setForm((current) => ({ ...current, [field]: value }))

  async function blurCnpj() {
    if (!form.cnpj.trim()) return
    const masked = maskCnpj(form.cnpj)
    set('cnpj', masked)
    if (!isValidCnpj(masked)) return
    setCnpjNotice(CNPJ_LOOKING)
    const found = await api.lookupCompany({ cnpj: masked }).catch(() => ({ companyName: null }))
    const companyName = found.companyName
    // Nunca bloqueia: a consulta é conveniência, não porteira.
    if (!companyName) return setCnpjNotice(CNPJ_FAILED)
    setForm((current) => (current.empresa.trim() ? current : { ...current, empresa: companyName }))
    setCnpjNotice('')
  }

  async function submit() {
    if (inFlight.current) return
    const found = registrationClientErrors(form)
    setErrors(found)
    const first = REGISTRATION_FIELD_ORDER.find((field) => found[field])
    if (first) {
      setSubmitError(MISSING_FIELDS)
      document.getElementById(errorId(first))?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
      return
    }
    setSubmitError('')
    inFlight.current = true
    setSending(true)
    try {
      const result = await api.submit({
        evento: event.slug,
        sessaoId: form.sessaoId ?? 0,
        nome: form.nome,
        email: form.email,
        telefone: form.telefone,
        empresa: form.empresa,
        cnpj: form.cnpj,
        cargo: form.cargo,
        aceite: form.aceite,
      })
      if (result.ok) {
        setReceipt(result.receipt)
        window.scrollTo?.({ top: 0, behavior: 'smooth' })
      } else {
        setSubmitError(refusal(result.error))
      }
    } catch (error) {
      // Falha de rede chega como TypeError; qualquer outra exceção nunca mostra o texto cru.
      setSubmitError(error instanceof TypeError ? NETWORK_FAILURE : refusal(REGISTRATION_FALLBACK))
    } finally {
      inFlight.current = false
      setSending(false)
    }
  }

  const chosenSession = receipt ? (event.sessions.find((session) => session.id === form.sessaoId) ?? null) : null

  return { form, errors, cnpjNotice, submitError, sending, receipt, chosenSession, set, blurCnpj, submit }
}

export type RegistrationFormController = ReturnType<typeof useRegistrationForm>
