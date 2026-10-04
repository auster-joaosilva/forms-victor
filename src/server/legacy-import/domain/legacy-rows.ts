export interface LegacyUser {
  usuario: string
  nome: string | null
  papel: string
  ativo: number
  criado_em: string
  acesso_em: string | null
}

export interface LegacyInvitation {
  token: string
  nome_empresa: string | null
  cnpj: string | null
  email: string | null
  observacao: string | null
  criado_em: string
  criado_por: string | null
  aberturas: number
  aberto_em: string | null
}

export interface LegacyResponse {
  id: number
  protocolo: string
  token_convite: string | null
  recebido_em: string
  nome_empresa: string | null
  cnpj: string | null
  solicitante: string | null
  email: string | null
  telefone: string | null
  versao: string | null
  saida: string | null
  posicao: string | null
  certeza: string | null
  urgencia: string | null
  confianca: string | null
  solicitante_no_qsa: string | null
  pacote: string
  situacao: string
  nota_interna: string | null
  tratado_por: string | null
  tratado_em: string | null
}

export interface LegacyEvent {
  id: number
  quando: string
  quem: string | null
  o_que: string
  referencia: string | null
  detalhe: string | null
}

export interface LegacyAdhesion {
  id: number
  protocolo: string
  resposta_id: number | null
  token_convite: string | null
  aceito_em: string
  nome_empresa: string | null
  cnpj: string | null
  representante: string | null
  cpf: string | null
  cargo: string | null
  email: string | null
  telefone: string | null
  modalidade: string
  sem_manifestacao: string | null
  quer_proposta: number
  versao_termo: string
  resumo_termo: string
  origem: string | null
  agente: string | null
  pacote: string
  situacao: string
  nota_interna: string | null
  tratado_por: string | null
  tratado_em: string | null
}

export interface LegacyAgendaEvent {
  id: number
  apelido: string
  titulo: string
  situacao: string
  inscricoes: string
  conteudo: string
  criado_em: string
  criado_por: string | null
  alterado_em: string | null
  alterado_por: string | null
}

export interface LegacyAgendaSession {
  id: number
  evento_id: number
  ordem: number
  data: string
  hora: string
  formato: string
  titulo: string
  descricao: string | null
  local: string | null
  vagas: number | null
}

export interface LegacyRegistration {
  id: number
  protocolo: string
  evento_id: number
  sessao_id: number
  resposta_id: number | null
  criado_em: string
  nome: string
  email: string
  telefone: string | null
  empresa: string | null
  cnpj: string | null
  cargo: string | null
  aceite_lgpd: number
  origem: string | null
  agente: string | null
  pacote: string
  situacao: string
  nota_interna: string | null
  tratado_por: string | null
  tratado_em: string | null
}
