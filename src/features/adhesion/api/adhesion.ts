import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { adhesionPage, submitAdhesion as submitBody } from '@/server/adhesion/composition'
import { lookupCompany } from '@/server/company-lookup/composition'
import {
  clearAdhesionReceiptCookie,
  readAdhesionReceiptCookie,
  writeAdhesionReceiptCookie,
} from '@/server/shared/http/adhesion-receipt-cookie'
import { requestOrigin } from '@/server/shared/http/request-origin'
import type { AdhesionBootstrap, SubmitAdhesionWire } from '../types/adhesion'
import { guardSubmit } from './guard-submit'
import { loadAdhesionPageInput, lookupAdhesionCompanyInput, submitAdhesionInput } from './schemas'

export const loadAdhesionPage = createServerFn({ method: 'GET' })
  .inputValidator(loadAdhesionPageInput)
  .handler(async ({ data }): Promise<AdhesionBootstrap> => {
    const receiptToken = readAdhesionReceiptCookie()
    const page = await adhesionPage.load({ inviteToken: data.invite, receiptToken })
    if (receiptToken && !page.receipt) clearAdhesionReceiptCookie()
    return page
  })

// Só a razão social sai daqui: o QSA e o resto do cadastro ficam no servidor.
export const lookupAdhesionCompany = createServerFn({ method: 'POST' })
  .inputValidator(lookupAdhesionCompanyInput)
  .handler(async ({ data }): Promise<{ companyName: string | null }> => {
    const result = await lookupCompany({ cnpj: data.cnpj })
    return { companyName: result.ok ? result.company.legalName : null }
  })

export const submitAdhesion = createServerFn({ method: 'POST' })
  .inputValidator(submitAdhesionInput)
  .handler(async ({ data }): Promise<SubmitAdhesionWire> => {
    const headers = getRequest().headers
    const result = await guardSubmit(() =>
      submitBody({ body: data, origin: requestOrigin(headers), userAgent: headers.get('user-agent') }),
    )
    if (!result.ok) return result
    writeAdhesionReceiptCookie(result.receiptToken)
    return { ok: true, receipt: result.receipt }
  })

export const startNewAdhesion = createServerFn({ method: 'POST' }).handler(() => {
  clearAdhesionReceiptCookie()
})
