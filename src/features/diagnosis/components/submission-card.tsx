import type { SubmissionState } from '../hooks/form-state'

export function retryWaitText(seconds: number): string {
  if (seconds < 60) return seconds === 1 ? '1 segundo' : `${seconds} segundos`
  const minutes = Math.ceil(seconds / 60)
  return minutes === 1 ? '1 minuto' : `${minutes} minutos`
}

export function SubmissionCard({ submission, onRetry }: { submission: SubmissionState; onRetry(): void }) {
  return (
    <div className="dx-card dx-submission">
      <h2>Protocolo {submission.status === 'sent' ? submission.protocol : '…'}</h2>
      {submission.status === 'sent' ? (
        <p className="dx-submission-text is-ok">
          <b>Respostas enviadas automaticamente.</b> A equipe recebe com este protocolo e retoma o contato pelo e-mail que você informou.
        </p>
      ) : submission.status === 'sending' ? (
        <p className="dx-submission-text">Enviando…</p>
      ) : (
        <p className="dx-submission-text">Guarde este número: é por ele que a equipe encontra as suas respostas.</p>
      )}
      {submission.status === 'failed' ? (
        <p className="dx-submission-text is-error">
          <b>Não deu para enviar agora</b> ({submission.reason}). Tente outra vez — suas respostas não foram perdidas.
        </p>
      ) : null}
      {submission.status === 'rate_limited' ? (
        <p className="dx-submission-text is-error">
          <b>Não deu para enviar agora</b> (muitos envios seguidos deste endereço). Tente de novo em {retryWaitText(submission.retryAfterSeconds)} — suas
          respostas não foram perdidas.
        </p>
      ) : null}
      {submission.status === 'sent' || submission.status === 'sending' ? null : (
        <button type="button" className="dx-button is-primary" onClick={onRetry}>
          Enviar minhas respostas agora
        </button>
      )}
    </div>
  )
}
