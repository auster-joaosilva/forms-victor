import { useState } from 'react'
import type {
  AdhesionCompany,
  AdhesionReceipt,
  Modality,
  WithoutManifestationChoice,
} from '@/server/adhesion/domain/adhesion'
import {
  CLIENT_FIELD_ORDER,
  clientErrors,
  isValidCnpj,
  maskCnpj,
  maskCpf,
  type ClientField,
} from '@/server/adhesion/domain/client-rules'
import { CURRENT_TERM } from '@/server/adhesion/domain/term'
import type { AdhesionApi, AdhesionPrefill } from '../types/adhesion'

export const CNPJ_HINT = 'digite o CNPJ e saia do campo: a razão social vem da Receita'
export const CNPJ_LOOKING = 'consultando…'
export const CNPJ_FAILED = 'não consegui consultar o cadastro agora — confira a razão social à mão.'
export const MISSING_FIELDS = 'Faltam campos acima.'

export const errorId = (field: ClientField) => `adhesion-error-${field}`

export interface AdhesionFormState {
  empresa: AdhesionCompany
  modalidade: Modality | null
  semManifestacao: WithoutManifestationChoice | null
  querProposta: boolean
  declara: boolean
}

const emptyForm = (prefill: AdhesionPrefill = {}): AdhesionFormState => ({
  empresa: {
    nomeEmpresa: prefill.nomeEmpresa ?? '',
    cnpj: prefill.cnpj ?? '',
    representante: '',
    cpf: '',
    cargo: '',
    email: prefill.email ?? '',
    telefone: '',
  },
  modalidade: null,
  semManifestacao: null,
  querProposta: false,
  declara: false,
})

// Exceção (validação, rede, banco) nunca mostra a mensagem crua à pessoa.
export const SEND_FALLBACK = 'não foi possível registrar'
const sendFailure = (reason: string) => `Não consegui registrar: ${reason}. Tente de novo.`

function scrollToError(field: ClientField) {
  document.getElementById(errorId(field))?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
}

export function useAdhesionForm({
  api,
  prefill,
  invitationToken,
  initialReceipt,
}: {
  api: AdhesionApi
  prefill: AdhesionPrefill
  invitationToken: string | null
  initialReceipt: AdhesionReceipt | null
}) {
  const [form, setForm] = useState<AdhesionFormState>(() => emptyForm(prefill))
  const [errors, setErrors] = useState<Partial<Record<ClientField, string>>>({})
  const [cnpjNotice, setCnpjNotice] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [sending, setSending] = useState(false)
  const [receipt, setReceipt] = useState<AdhesionReceipt | null>(initialReceipt)
  const [link, setLink] = useState<string | null>(invitationToken)

  const setCompany = (field: keyof AdhesionCompany, value: string) =>
    setForm((current) => ({ ...current, empresa: { ...current.empresa, [field]: value } }))

  const chooseModality = (modalidade: Modality) =>
    setForm((current) => ({
      ...current,
      modalidade,
      semManifestacao: modalidade === 'hibrido' ? current.semManifestacao : null,
    }))

  const chooseWithoutManifestation = (semManifestacao: WithoutManifestationChoice) => {
    setForm((current) => ({ ...current, semManifestacao }))
    setErrors((current) => ({ ...current, semManifestacao: undefined }))
  }

  const setQuerProposta = (querProposta: boolean) => setForm((current) => ({ ...current, querProposta }))
  const setDeclara = (declara: boolean) => setForm((current) => ({ ...current, declara }))

  const blurCpf = () =>
    setForm((current) => ({ ...current, empresa: { ...current.empresa, cpf: maskCpf(current.empresa.cpf) } }))

  async function blurCnpj() {
    if (!form.empresa.cnpj.trim()) return
    const masked = maskCnpj(form.empresa.cnpj)
    setCompany('cnpj', masked)
    if (!isValidCnpj(masked)) return
    setCnpjNotice(CNPJ_LOOKING)
    const found = await api.lookupCompany({ cnpj: masked }).catch(() => ({ companyName: null }))
    const companyName = found.companyName
    // Nunca bloqueia: a consulta é conveniência, não porteira.
    if (!companyName) return setCnpjNotice(CNPJ_FAILED)
    setForm((current) =>
      current.empresa.nomeEmpresa.trim()
        ? current
        : { ...current, empresa: { ...current.empresa, nomeEmpresa: companyName } },
    )
    setCnpjNotice('')
  }

  async function submit() {
    const found = clientErrors(form)
    setErrors(found)
    const first = CLIENT_FIELD_ORDER.find((field) => found[field])
    if (first || !form.modalidade) {
      setSubmitError(MISSING_FIELDS)
      scrollToError(first ?? 'modalidade')
      return
    }
    setSubmitError('')
    setSending(true)
    try {
      const result = await api.submit({
        vinculo: link,
        versaoTermo: CURRENT_TERM.versao,
        empresa: form.empresa,
        modalidade: form.modalidade,
        semManifestacao: form.modalidade === 'hibrido' ? form.semManifestacao : null,
        querProposta: form.querProposta,
        declara: form.declara,
      })
      if (result.ok) {
        setReceipt(result.receipt)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        setSubmitError(sendFailure(result.error))
      }
    } catch {
      setSubmitError(sendFailure(SEND_FALLBACK))
    } finally {
      setSending(false)
    }
  }

  async function startNew() {
    await api.startNew()
    setForm(emptyForm())
    setErrors({})
    setSubmitError('')
    setCnpjNotice('')
    setLink(null)
    setReceipt(null)
  }

  return {
    form,
    errors,
    cnpjNotice,
    submitError,
    sending,
    receipt,
    setCompany,
    chooseModality,
    chooseWithoutManifestation,
    setQuerProposta,
    setDeclara,
    blurCnpj,
    blurCpf,
    submit,
    startNew,
  }
}

export type AdhesionFormController = ReturnType<typeof useAdhesionForm>
