/* Papéis e permissões do backoffice — fonte única.
 *
 * POR QUE UMA TABELA, E NÃO CHECAGEM ESPALHADA
 *
 * Antes desta tabela havia dois papéis (`admin` e `equipe`) e quatro checagens
 * no servidor inteiro — todas na área de usuários. As outras vinte rotas
 * respondiam a qualquer pessoa autenticada: toda resposta de diagnóstico, toda
 * adesão com CNPJ e CPF do representante, as três planilhas e a trilha de
 * auditoria. O painel escondia abas, mas esconder botão não fecha rota: quem
 * soubesse o endereço alcançava.
 *
 * Com a regra espalhada, proteger uma rota nova depende de alguém lembrar. Com
 * a tabela, a rota que não estiver aqui NÃO RESPONDE — e há teste que falha se
 * uma rota do backoffice ficar de fora. Esquecer passa a ser erro barulhento,
 * não buraco silencioso.
 *
 * O painel não repete nada disto: recebe do servidor a lista de capacidades de
 * quem entrou e esconde o que não estiver nela. Regra em dois lugares é regra
 * que diverge.
 */

/** Os quatro papéis, decididos por Victor em 01/10/2026.
 *
 *  `gestor` é "tudo menos criar usuário" — chefia sem poder abrir acesso.
 *  `regularizacao` trata a adesão e protocola a opção no Portal do Simples.
 *  `operador` cuida de convite, evento e inscrição, e NÃO alcança adesão.
 *
 *  Sem acento e sem cedilha no identificador: isto vai para coluna de banco,
 *  para URL e para comparação. O acento mora no rótulo, que é o que se lê. */
export const PAPEIS = ['admin', 'gestor', 'regularizacao', 'operador'];

export const ROTULOS = {
  admin: 'administrador',
  gestor: 'gestor de departamento',
  regularizacao: 'regularização',
  operador: 'operador',
};

/** O papel de quem entra sem papel reconhecido. O mais fechado dos quatro:
 *  papel corrompido ou vindo de versão antiga não vira passe livre. */
export const PAPEL_PADRAO = 'operador';

/* As capacidades. Nome do que se FAZ, não do lugar onde se clica — a aba muda
   de nome, a capacidade não.

   `proprio_acesso` é a única que todo mundo tem: trocar a própria senha. A rota
   de alteração de usuário entra por ela e decide lá dentro quais campos a
   pessoa pode mexer — quem não administra só alcança a própria senha. */
const TODAS = [
  'painel',
  'proprio_acesso',
  'ver_respostas', 'tratar_respostas', 'exportar_respostas',
  'ver_adesoes', 'tratar_adesoes', 'exportar_adesoes', 'reimprimir_termo',
  'ver_convites', 'gerir_convites',
  'ver_eventos', 'gerir_eventos', 'tratar_inscricoes', 'exportar_inscricoes',
  'ver_auditoria',
  'gerir_usuarios',
];

const COMUNS = ['painel', 'proprio_acesso'];

export const CAPACIDADES = {
  admin: [...TODAS],

  // Tudo menos abrir acesso para alguém.
  gestor: TODAS.filter(c => c !== 'gerir_usuarios'),

  /* Exportação e auditoria ficam de fora por decisão de Victor: planilha com
     CPF e CNPJ é a maior superfície de vazamento do painel, e a trilha diz
     quem fez o quê — as duas sobem para a chefia. */
  regularizacao: [...COMUNS,
    'ver_respostas', 'tratar_respostas',
    'ver_adesoes', 'tratar_adesoes', 'reimprimir_termo'],

  operador: [...COMUNS,
    'ver_respostas', 'tratar_respostas',
    'ver_convites', 'gerir_convites',
    'ver_eventos', 'gerir_eventos', 'tratar_inscricoes'],
};

/** O que cada rota do backoffice exige. Chave: `MÉTODO caminho`.
 *
 *  Rota ausente desta tabela é recusada com 403 — e o teste de cobertura falha
 *  antes, apontando o nome dela. */
export const ROTAS = {
  'GET /backoffice': 'painel',

  'GET /api/backoffice/respostas': 'ver_respostas',
  'GET /api/backoffice/resposta': 'ver_respostas',
  'GET /api/backoffice/dicionario': 'ver_respostas',
  'GET /backoffice/relatorio': 'ver_respostas',
  'POST /api/backoffice/tratar': 'tratar_respostas',
  'GET /api/backoffice/planilha.csv': 'exportar_respostas',

  'GET /api/backoffice/adesoes': 'ver_adesoes',
  'POST /api/backoffice/adesoes/tratar': 'tratar_adesoes',
  'GET /api/backoffice/adesoes.csv': 'exportar_adesoes',
  'GET /backoffice/termo': 'reimprimir_termo',

  'GET /api/backoffice/convites': 'ver_convites',
  'POST /api/backoffice/convites': 'gerir_convites',
  'POST /api/backoffice/convites/apagar': 'gerir_convites',

  'GET /api/backoffice/eventos': 'ver_eventos',
  'POST /api/backoffice/eventos': 'gerir_eventos',
  'POST /api/backoffice/eventos/alterar': 'gerir_eventos',
  'GET /api/backoffice/imagens': 'gerir_eventos',
  'POST /api/backoffice/inscricoes/tratar': 'tratar_inscricoes',
  'GET /api/backoffice/inscricoes.csv': 'exportar_inscricoes',

  'GET /api/backoffice/auditoria': 'ver_auditoria',

  'GET /api/backoffice/usuarios': 'gerir_usuarios',
  'POST /api/backoffice/usuarios': 'gerir_usuarios',
  // A rota decide lá dentro: quem não administra só troca a própria senha.
  'POST /api/backoffice/usuarios/alterar': 'proprio_acesso',
};

/** Papel reconhecido? Senão, o mais fechado. */
export const papelValido = p => (PAPEIS.includes(p) ? p : PAPEL_PADRAO);

export const capacidadesDe = papel => CAPACIDADES[papelValido(papel)];

export const pode = (papel, capacidade) =>
  capacidadesDe(papel).includes(capacidade);

/** A capacidade exigida por uma rota, ou `null` se ela não está na tabela —
 *  e rota fora da tabela não responde. */
export const exigidaPor = (metodo, rota) => ROTAS[`${metodo} ${rota}`] ?? null;

export const podeNaRota = (papel, metodo, rota) => {
  const c = exigidaPor(metodo, rota);
  return c === null ? false : pode(papel, c);
};
