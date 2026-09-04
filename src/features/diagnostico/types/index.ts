export type ContatoPublico = {
  papel: string
  nome: string
  telefone: string
  email: string
}

export const contatoVazio = (): ContatoPublico => ({
  papel: '',
  nome: '',
  telefone: '',
  email: '',
})

/** Os tres campos de anexo da etapa 7. */
export type CampoAnexo = 'situacao_fiscal' | 'cdas_pgfn' | 'contabeis'

/**
 * O formulario, so com o que e serializavel.
 *
 * `File` fica fora de proposito: o rascunho vai para o localStorage e arquivo
 * nao sobrevive a isso. Os `anexo*` guardam apenas o NOME do que foi
 * escolhido, para o Zod ter o que exigir e a revisao ter o que mostrar — e
 * justamente por isso eles nao entram no rascunho salvo.
 */
export type DiagnosticoValores = {
  email: string
  nomeSolicitante: string
  escritorioParceiro: string
  nomeContribuinte: string
  cnpjCpf: string
  telefone: string
  possuiGrupoWhatsapp: string
  nomeGrupoWhatsapp: string
  contatoCliente: ContatoPublico
  contatoParceiro: ContatoPublico
  tratativa: string
  procuracaoFeita: string
  formaAcesso: string
  faturamentoMensal: string
  debitosConcentrados: Array<string>
  valorPassivo: string
  pendenciaFiscal: string
  quaisPendencias: Array<string>
  riscoImediato: string
  quaisRiscos: Array<string>
  ondaCalor: string
  informacoesAdicionais: string
  anexoSituacaoFiscal: string
  anexoCDAs: string
}

export const valoresIniciais = (): DiagnosticoValores => ({
  email: '',
  nomeSolicitante: '',
  escritorioParceiro: '',
  nomeContribuinte: '',
  cnpjCpf: '',
  telefone: '',
  possuiGrupoWhatsapp: '',
  nomeGrupoWhatsapp: '',
  contatoCliente: contatoVazio(),
  contatoParceiro: contatoVazio(),
  tratativa: '',
  procuracaoFeita: '',
  formaAcesso: '',
  faturamentoMensal: '',
  debitosConcentrados: [],
  valorPassivo: '',
  pendenciaFiscal: '',
  quaisPendencias: [],
  riscoImediato: '',
  quaisRiscos: [],
  ondaCalor: '',
  informacoesAdicionais: '',
  anexoSituacaoFiscal: '',
  anexoCDAs: '',
})

/** Chave de erro: um campo do formulario, ou `contatos`, que e dos dois. */
export type ChaveErro = keyof DiagnosticoValores | 'contatos'

export type ErrosDiagnostico = Partial<Record<ChaveErro, string>>

export type ArquivosDiagnostico = Record<CampoAnexo, Array<File>>

export const arquivosVazios = (): ArquivosDiagnostico => ({
  situacao_fiscal: [],
  cdas_pgfn: [],
  contabeis: [],
})
