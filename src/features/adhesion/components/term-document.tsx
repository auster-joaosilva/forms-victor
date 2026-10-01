import type { AdhesionReceipt } from '@/server/adhesion/domain/adhesion'
import type { TermText } from '../types/adhesion'

export function TermDocument({ term, adhesion }: { term: TermText; adhesion: AdhesionReceipt }) {
  const { empresa } = adhesion
  const chosen = term.modalidades.find((option) => option.valor === adhesion.modalidade)
  const withoutManifestation =
    term.semManifestacao.opcoes.find(([value]) => value === adhesion.semManifestacao)?.[1] ?? ''
  return (
    <div className="ad-doc">
      <div className="ad-sheet">
        <h1>{term.titulo}</h1>
        <div className="ad-sheet-subline">{term.subtitulo}</div>

        <p className="ad-label">1. Identificação da empresa</p>
        <table className="ad-ident">
          <tbody>
            <tr>
              <td className="is-label">Razão social</td>
              <td>{empresa.nomeEmpresa}</td>
              <td className="is-label">CNPJ</td>
              <td>{empresa.cnpj}</td>
            </tr>
            <tr>
              <td className="is-label">Representante</td>
              <td>{empresa.representante}</td>
              <td className="is-label">CPF</td>
              <td>{empresa.cpf}</td>
            </tr>
            <tr>
              <td className="is-label">Cargo</td>
              <td>{empresa.cargo}</td>
              <td className="is-label">E-mail</td>
              <td>{empresa.email}</td>
            </tr>
            <tr>
              <td className="is-label">Telefone</td>
              <td>{empresa.telefone}</td>
              <td className="is-label">Protocolo</td>
              <td>{adhesion.protocol}</td>
            </tr>
          </tbody>
        </table>

        <div className="ad-term">
          <div className="ad-term-section">
            <p className="ad-label">2. Orientação recebida</p>
            <p>{term.orientacao}</p>
            <div className="ad-box">
              <div className="ad-box-title">
                {term.prazos.titulo} <span className="ad-source">({term.prazos.fonte})</span>
              </div>
              <ul>
                {term.prazos.itens.map(([label, text]) => (
                  <li key={label}>
                    <b>{label}:</b> {text}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="ad-term-section">
            <p className="ad-label">3. Critérios que orientam a recomendação</p>
            {term.criterios.map(([label, text]) => (
              <p key={label}>
                <b>{label}</b> {text}
              </p>
            ))}
          </div>
          <div className="ad-term-section">
            <p className="ad-label">4. Serviços complementares</p>
            <p>{term.servicos.abertura}</p>
            <ul>
              {term.servicos.itens.map(([label, text]) => (
                <li key={label}>
                  <b>{label}:</b> {text}
                </li>
              ))}
            </ul>
            <p>
              <b>{adhesion.querProposta ? '[X]' : '[  ]'}</b> {term.servicos.pergunta}
            </p>
          </div>
          <div className="ad-term-section">
            <p className="ad-label">5. Modalidade escolhida</p>
            <div className="ad-box">
              <div className="ad-box-title">[X] {chosen?.titulo ?? ''}</div>
              <p>{chosen?.texto ?? ''}</p>
              {(chosen?.partes ?? []).map(([label, text]) => (
                <p key={label}>
                  <b>{label}:</b> {text}
                </p>
              ))}
              {adhesion.modalidade === 'hibrido' ? (
                <p>
                  <b>{term.semManifestacao.enunciado}</b>
                  <br />
                  [X] {withoutManifestation}
                </p>
              ) : null}
            </div>
          </div>
          <div className="ad-term-section">
            <p className="ad-label">6. Ciência sobre a decisão e reavaliação</p>
            <ul>
              {term.ciencia.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
          </div>
          <div className="ad-term-section">
            <p className="ad-label">Declaração final</p>
            <div className="ad-box">
              <p className="ad-box-last">{term.declaracao}</p>
            </div>
          </div>
        </div>

        <div className="ad-proof">
          <div className="ad-proof-title">Registro do aceite eletrônico</div>
          Confirmado por <b>{empresa.representante}</b>, CPF {empresa.cpf}, na qualidade de {empresa.cargo},
          em <b>{adhesion.acceptedAtDisplay}</b>
          {` (${adhesion.acceptedAt}).`}
          <br />
          Protocolo {adhesion.protocol} · origem do acesso {adhesion.originIp || 'não registrada'} · versão do
          termo {adhesion.termVersion || term.versao}
          <br />
          Resumo criptográfico do texto aceito (SHA-256): {adhesion.termHash}
          <br />
          Aceite manifestado por meio eletrônico no portal da Auster Inteligência Contábil. O resumo acima
          identifica o texto exato a que o representante aderiu.
        </div>

        <div className="ad-sheet-footer">{term.rodape}</div>
      </div>
    </div>
  )
}
