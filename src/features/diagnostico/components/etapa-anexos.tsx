import { FileInput } from '#/components/ui/file-input/file-input'
import { Textarea } from '#/components/ui/textarea/textarea'

import { useDiagnostico } from '../stores/diagnostico-store'

import estilos from './etapa-anexos.module.css'
import layout from './etapa.module.css'

/**
 * Manual de emissao ao lado de cada anexo obrigatorio.
 *
 * Nao e enfeite: a maioria de quem preenche nao sabe emitir Situacao Fiscal
 * no e-CAC nem o relatorio de CDAs no Regularize, e sem o passo a passo o
 * formulario simplesmente nao e concluido.
 */
function Manual({
  pergunta,
  explicacao,
  arquivo,
}: {
  pergunta: string
  explicacao: string
  arquivo: string
}) {
  return (
    <div className={estilos.manual}>
      <p className={estilos.pergunta}>{pergunta}</p>
      <p className={estilos.explicacao}>{explicacao}</p>
      <div className={estilos.acoes}>
        <a
          className={estilos.link}
          href={arquivo}
          target="_blank"
          rel="noopener noreferrer"
        >
          Visualizar manual
        </a>
        <a className={estilos.link} href={arquivo} download>
          Baixar
        </a>
      </div>
    </div>
  )
}

export function EtapaAnexos() {
  const { valores, arquivos, erros, atualizar, definirArquivos } =
    useDiagnostico()

  return (
    <div className={layout.pilha}>
      <div className={layout.bloco}>
        <FileInput
          nome="anexoSituacaoFiscal"
          rotulo="Anexo: Situação Fiscal"
          descricao="Relatório de situação fiscal emitido pelo e-CAC da Receita Federal."
          obrigatorio
          arquivos={arquivos.situacao_fiscal}
          erro={erros.anexoSituacaoFiscal}
          onChange={(lista) => definirArquivos('situacao_fiscal', lista)}
        />
        <Manual
          pergunta="Não sabe como obter a Situação Fiscal?"
          explicacao="O manual tem o passo a passo para emitir o relatório no e-CAC."
          arquivo="/manuais/Como-Emitir-a-Situacao-Fiscal.pdf"
        />
      </div>

      <div className={layout.bloco}>
        <FileInput
          nome="anexoCDAs"
          rotulo="Anexo: Relatório de CDAs da PGFN"
          descricao="Relatório de Certidões de Dívida Ativa obtido no sistema Regularize."
          obrigatorio
          arquivos={arquivos.cdas_pgfn}
          erro={erros.anexoCDAs}
          onChange={(lista) => definirArquivos('cdas_pgfn', lista)}
        />
        <Manual
          pergunta="Não sabe como obter o Relatório de CDAs?"
          explicacao="O manual tem o procedimento para baixar o relatório no Regularize da PGFN."
          arquivo="/manuais/PGFN.pdf"
        />
      </div>

      <FileInput
        multiplo
        nome="anexoContabeis"
        rotulo="Anexo: documentos contábeis"
        descricao="Balanço, balancete, DRE, razão — últimos 5 anos. Opcional."
        arquivos={arquivos.contabeis}
        onChange={(lista) => definirArquivos('contabeis', lista)}
      />

      <Textarea
        nome="informacoesAdicionais"
        rotulo="Informações relevantes adicionais"
        placeholder="Qualquer informação relevante sobre o caso, outros CNPJs do grupo econômico…"
        valor={valores.informacoesAdicionais}
        onChange={(v) => atualizar('informacoesAdicionais', v)}
      />
    </div>
  )
}
