import type { CompanyState } from '../hooks/form-state'

export function CnpjBadge({ state }: { state: CompanyState }) {
  if (state.status === 'idle') return null
  if (state.status === 'loading') return <div className="dx-company is-loading">Conferindo o cadastro na Receita…</div>
  if (state.status === 'failed') {
    return (
      <div className="dx-company is-warning">
        Não deu para consultar o CNPJ agora ({state.reason || 'indisponível'}). <b>Preencha o nome da empresa à mão</b> — o diagnóstico segue igual.
      </div>
    )
  }
  const { company } = state
  const parts = [
    company.city ? `${company.city}/${company.state}` : null,
    company.simplesOptant ? 'optante pelo Simples' : 'não optante pelo Simples',
    company.meiOptant ? 'MEI' : null,
  ].filter((part): part is string => part !== null)
  return (
    <div className={company.active ? 'dx-company is-found' : 'dx-company is-warning'}>
      <b>{company.legalName}</b>
      {parts.map((part) => ` · ${part}`).join('')}
      {company.active ? null : (
        <>
          <br />
          Situação cadastral: <b>{company.registrationStatus || 'não ativa'}</b>. Confirme antes de seguir.
        </>
      )}
    </div>
  )
}
