import { useState } from 'react'
import { formatShortDateTime } from '@/server/diagnosis/domain/dates'
import type { InvitationView } from '../api/invitations'

export type InvitationFields = { companyName: string; cnpj: string; email: string }

type Props = {
  invitations: InvitationView[]
  error: string | null
  pending: boolean
  onCreate(input: InvitationFields): Promise<boolean>
  onDelete(token: string): void
  onCopy(link: string): void
}

const DELETE_CONFIRMATION = 'Apagar este convite? O link para de funcionar na hora, inclusive para quem já o recebeu.'

function InvitationRow({ invitation, onDelete, onCopy }: { invitation: InvitationView } & Pick<Props, 'onDelete' | 'onCopy'>) {
  const deletable = invitation.responseCount === 0 && invitation.adhesionCount === 0
  return (
    <tr>
      <td>
        <b>{invitation.companyName || '(sem nome)'}</b>
        <br />
        <span className="bo-muted">{invitation.cnpj ?? ''}</span>
      </td>
      <td>
        <span className="bo-link">{invitation.links.diagnosis}</span>
      </td>
      <td>
        {invitation.openCount}
        {invitation.lastOpenedAt ? (
          <>
            <br />
            <span className="bo-muted">{formatShortDateTime(invitation.lastOpenedAt)}</span>
          </>
        ) : null}
      </td>
      <td>{invitation.responseCount}</td>
      <td>
        {formatShortDateTime(invitation.createdAt)}
        <br />
        <span className="bo-muted">{invitation.createdBy ?? ''}</span>
      </td>
      <td style={{ whiteSpace: 'nowrap' }}>
        <button type="button" className="bo-button is-light" onClick={() => onCopy(invitation.links.diagnosis)}>
          Diagnóstico
        </button>
        <button type="button" className="bo-button is-light" onClick={() => onCopy(invitation.links.adhesion)}>
          Adesão
        </button>
        {deletable ? (
          <button type="button" className="bo-button is-light" onClick={() => window.confirm(DELETE_CONFIRMATION) && onDelete(invitation.token)}>
            Apagar
          </button>
        ) : null}
      </td>
    </tr>
  )
}

export function InvitationsView({ invitations, error, pending, onCreate, onDelete, onCopy }: Props) {
  const [companyName, setCompanyName] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [email, setEmail] = useState('')
  const create = async () => {
    if (!(await onCreate({ companyName: companyName.trim(), cnpj: cnpj.trim(), email: email.trim() }))) return
    setCompanyName('')
    setCnpj('')
    setEmail('')
  }
  return (
    <>
      <h2 style={{ margin: '0 0 4px', fontSize: 'var(--text-title)', fontWeight: 400 }}>Um link por cliente</h2>
      <p className="bo-note" style={{ margin: '0 0 18px' }}>
        Cada link chega com o nome e o CNPJ preenchidos e amarra o que o cliente responder a quem você enviou. Depois de gerar, há dois
        botões: <b>Diagnóstico</b> abre o formulário; <b>Adesão</b> abre o termo de opção, para quem já decidiu e só precisa formalizar.
        Para divulgação aberta, use o endereço sem <code>?invite=</code> — aí a resposta entra como &quot;link aberto&quot;.
      </p>
      <div className="bo-filters">
        <input type="text" placeholder="Razão social" value={companyName} onChange={(event) => setCompanyName(event.target.value)} />
        <input type="text" placeholder="CNPJ" style={{ minWidth: 170 }} value={cnpj} onChange={(event) => setCnpj(event.target.value)} />
        <input type="text" placeholder="E-mail de contato (opcional)" value={email} onChange={(event) => setEmail(event.target.value)} />
        <button type="button" className="bo-button" disabled={pending} onClick={() => void create()}>
          Gerar link
        </button>
      </div>
      {error ? <div className="bo-error">{error}</div> : null}
      {invitations.length ? (
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Link</th>
              <th>Aberturas</th>
              <th>Respostas</th>
              <th>Criado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {invitations.map((invitation) => (
              <InvitationRow key={invitation.token} invitation={invitation} onDelete={onDelete} onCopy={onCopy} />
            ))}
          </tbody>
        </table>
      ) : (
        <div className="bo-empty">Nenhum convite ainda. Preencha a razão social ou o CNPJ acima e gere o primeiro link.</div>
      )}
    </>
  )
}
