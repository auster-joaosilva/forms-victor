import type { EventSessionView } from '@/server/events/domain/event'
import type { RegistrationReceiptWire } from '../types/events'
import { sessionLabel } from '@/server/events/domain/event'

export function RegistrationReceipt({ receipt, session }: { receipt: RegistrationReceiptWire; session: EventSessionView | null }) {
  const meeting = session ? sessionLabel(session) : receipt.sessionLabel
  return (
    <>
      <div className="recibo">
        <div className="visto">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 7 9 18l-5-5" />
          </svg>
        </div>
        <h2>{receipt.repeated ? 'Você já estava inscrito' : 'Inscrição confirmada'}</h2>
        <div className="protocolo">{receipt.protocol}</div>
        {meeting && (
          <div className="linha">
            <b>Encontro:</b> <span>{meeting}</span>
          </div>
        )}
        <div className="linha">
          <b>Em nome de:</b> <span>{`${receipt.name} · ${receipt.email}`}</span>
        </div>
        <div className="linha">
          A equipe da Auster confirma a sua vaga por e-mail e manda as instruções antes do encontro. Guarde o protocolo: é por ele que
          encontramos a sua inscrição.
        </div>
      </div>
      <section className="fecho" style={{ marginTop: 22 }}>
        <span className="olho">enquanto isso</span>
        <h2>Chegue ao encontro com a sua conta feita</h2>
        <div className="regua" />
        <p className="linha-fina">
          Se a sua empresa é do Simples Nacional, o diagnóstico do portal mostra em minutos se ela deve permanecer na guia única ou
          recolher IBS e CBS por fora.
        </p>
        <div className="acoes">
          <a className="botao escura" href="/diagnosis">
            Fazer o diagnóstico
          </a>
          <a className="botao clara-borda" href="/events">
            Ver outros encontros
          </a>
        </div>
      </section>
    </>
  )
}
