import { useHydrated } from '@tanstack/react-router'
import type { AdhesionReceipt } from '@/server/adhesion/domain/adhesion'
import { MODALITY_LONG } from '@/server/adhesion/domain/labels'

export function ReceiptView({
  receipt,
  onPrint,
  onStartNew,
}: {
  receipt: AdhesionReceipt
  onPrint(): void
  onStartNew(): void
}) {
  const hydrated = useHydrated()
  return (
    <section className="ad-receipt">
      <div className="ad-receipt-panel">
        <h2>Opção registrada</h2>
        <div className="ad-receipt-protocol">{receipt.protocol}</div>
        <div className="ad-receipt-line">
          <b>Modalidade:</b> <span>{MODALITY_LONG[receipt.modalidade]}</span>
        </div>
        <div className="ad-receipt-line">
          <b>Registrado em:</b> <span>{receipt.acceptedAtDisplay}</span>
        </div>
        {receipt.modalidade === 'hibrido' ? (
          <div className="ad-receipt-line">
            A Auster fará a opção no Portal do Simples Nacional até 30/10/2026 e confirmará por e-mail.
          </div>
        ) : (
          <div className="ad-receipt-line">
            Nada a protocolar: a empresa permanece com a CBS dentro do DAS.
          </div>
        )}
      </div>
      <div className="ad-card">
        <h3 className="ad-receipt-keep">Guarde a sua via</h3>
        <p>
          O termo preenchido, com protocolo e registro do aceite, sai em PDF pelo botão abaixo. Guarde junto
          dos documentos da empresa.
        </p>
        <button type="button" className="ad-button" disabled={!hydrated} onClick={onPrint}>
          Baixar o termo (PDF)
        </button>
        <button type="button" className="ad-button is-secondary" disabled={!hydrated} onClick={onStartNew}>
          Nova confirmação
        </button>
        <a className="ad-button is-secondary" href="/diagnosis">
          Voltar ao diagnóstico
        </a>
      </div>
    </section>
  )
}
