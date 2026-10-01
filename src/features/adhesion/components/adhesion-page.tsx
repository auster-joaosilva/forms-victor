import { SiteHeader } from '@/components/brand/site-header'
import { printWhenReady } from '@/lib/print'
import { termFileName } from '@/server/adhesion/domain/labels'
import { CURRENT_TERM, termFor } from '@/server/adhesion/domain/term'
import { UNKNOWN_VERSION_MESSAGE } from '@/server/adhesion/domain/term-copy'
import { useAdhesionForm } from '../hooks/use-adhesion-form'
import type { AdhesionApi, AdhesionBootstrap } from '../types/adhesion'
import { AdhesionForm } from './adhesion-form'
import { ReceiptView } from './receipt'
import { TermDocument } from './term-document'
import { WindowClosed } from './window-closed'

export function AdhesionPage({
  bootstrap,
  api,
  print = printWhenReady,
}: {
  bootstrap: AdhesionBootstrap
  api: AdhesionApi
  print?: (title: string) => unknown
}) {
  const form = useAdhesionForm({
    api,
    prefill: bootstrap.prefill,
    invitationToken: bootstrap.invitationToken,
    initialReceipt: bootstrap.receipt,
  })
  const receipt = form.receipt
  const acceptedTerm = receipt ? termFor(receipt.termVersion) : null
  return (
    <div className="ad-page">
      <SiteHeader subtitle={CURRENT_TERM.subtitulo} />
      <main className="ad">
        {receipt ? (
          <>
            <ReceiptView
              receipt={receipt}
              onPrint={() => void print(termFileName(receipt.empresa.nomeEmpresa))}
              onStartNew={() => void form.startNew()}
            />
            {acceptedTerm ? (
              <TermDocument term={acceptedTerm} adhesion={receipt} />
            ) : (
              <div className="ad-card">{UNKNOWN_VERSION_MESSAGE(receipt.termVersion)}</div>
            )}
          </>
        ) : bootstrap.window.state === 'closed' ? (
          <WindowClosed end={bootstrap.window.end} />
        ) : (
          <AdhesionForm form={form} term={CURRENT_TERM} />
        )}
      </main>
    </div>
  )
}
