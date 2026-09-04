import type { Opcao } from '#/components/ui/types'

export const SIM_NAO: ReadonlyArray<Opcao> = [
  { valor: 'sim', rotulo: 'Sim' },
  { valor: 'nao', rotulo: 'Não' },
]

/**
 * Espelho de `aurora_papeis` do banco principal.
 *
 * Duplicar lista e sempre ruim, e aqui e o menor dos males: o formulario e
 * publico e roda sem sessao, e abrir leitura da tabela para a internet so
 * para preencher um `select` seria pior. Papel novo cadastrado la que nao
 * apareca aqui nao quebra nada — o valor e validado no servidor.
 */
export const PAPEIS_CONTATO: ReadonlyArray<Opcao> = [
  { valor: 'socio', rotulo: 'Sócio' },
  { valor: 'responsavel', rotulo: 'Responsável pela empresa' },
  { valor: 'financeiro', rotulo: 'Financeiro' },
  { valor: 'contador', rotulo: 'Contador' },
  { valor: 'advogado', rotulo: 'Advogado' },
  { valor: 'assistente', rotulo: 'Assistente' },
  { valor: 'parceiro', rotulo: 'Parceiro' },
  { valor: 'outro', rotulo: 'Outro' },
]

/** Como o servico e tratado. Espelha `clientes.tratativa`. */
export const TRATATIVAS: ReadonlyArray<Opcao> = [
  {
    valor: 'direto',
    rotulo: 'Direto com o cliente',
    descricao: 'A Auster fala com o cliente e combina tudo com ele.',
  },
  {
    valor: 'via_parceiro',
    rotulo: 'Sempre com validação do parceiro',
    descricao:
      'Proposta, prazo e condição passam pelo parceiro antes de fechar.',
  },
]

export const CONTATO_WHATSAPP: ReadonlyArray<Opcao> = [
  { valor: 'sim', rotulo: 'Sim, possuo grupo no WhatsApp' },
  { valor: 'nao', rotulo: 'Não, informar número de telefone' },
]

export const FORMAS_ACESSO: ReadonlyArray<Opcao> = [
  { valor: 'vpn', rotulo: 'Irei disponibilizar VPN para acesso' },
  { valor: 'documentos', rotulo: 'Irei enviar os documentos necessários' },
  { valor: 'meu_acesso', rotulo: 'Irei disponibilizar meu acesso' },
  { valor: 'certificado', rotulo: 'Irei disponibilizar um certificado digital' },
  { valor: 'sem_acesso', rotulo: 'Não tenho nenhum acesso ao cliente' },
]

export const FAIXAS_VALOR: ReadonlyArray<Opcao> = [
  { valor: 'ate_90k', rotulo: 'Até R$ 90 mil' },
  { valor: '90k_200k', rotulo: 'R$ 90 mil a R$ 200 mil' },
  { valor: '200k_600k', rotulo: 'R$ 200 mil a R$ 600 mil' },
  { valor: '600k_1m', rotulo: 'R$ 600 mil a R$ 1 milhão' },
  { valor: 'acima_1m', rotulo: 'Acima de R$ 1 milhão' },
  { valor: 'nao_sei', rotulo: 'Não Sei' },
]

export const ORIGENS_DEBITO: ReadonlyArray<Opcao> = [
  { valor: 'receita_federal', rotulo: 'Receita Federal' },
  { valor: 'pgfn', rotulo: 'PGFN (Dívida Ativa da União)' },
  { valor: 'sefaz', rotulo: 'SEFAZ (Estado)' },
  { valor: 'municipio', rotulo: 'Município (ISS, IPTU, taxas)' },
  { valor: 'nao_sei', rotulo: 'Não Sei' },
]

export const PENDENCIAS: ReadonlyArray<Opcao> = [
  { valor: 'execucao_fiscal', rotulo: 'Execução fiscal em andamento' },
  { valor: 'parcelamento_ativo', rotulo: 'Parcelamento ativo' },
  {
    valor: 'parcelamento_rescindido',
    rotulo: 'Parcelamento rescindido ou em risco de rescisão',
  },
  { valor: 'auto_infracao', rotulo: 'Auto de infração recente' },
  {
    valor: 'transacao_desconto',
    rotulo: 'Não consegue aderir a transação com desconto',
  },
]

export const RISCOS: ReadonlyArray<Opcao> = [
  { valor: 'bloqueio_contas', rotulo: 'Bloqueio de Contas' },
  { valor: 'penhora', rotulo: 'Penhora' },
  { valor: 'protesto', rotulo: 'Protesto' },
  { valor: 'certidao_negativa', rotulo: 'Certidão Negativa' },
  { valor: 'desenquadramento', rotulo: 'Desenquadramento Simples Nacional' },
]

/**
 * Onda de calor. `muito_interessado` NAO e so rotulo: junto com risco
 * imediato ele decide prioridade e prazo. Ver `utils/prazo.ts`.
 */
export const ONDAS_CALOR: ReadonlyArray<Opcao> = [
  { valor: 'nao_abordado', rotulo: 'Cliente ainda não foi abordado' },
  {
    valor: 'pouco_interessado',
    rotulo: 'Cliente está pouco interessado na transação',
  },
  {
    valor: 'muito_interessado',
    rotulo: 'Cliente está muito interessado na transação',
  },
]
