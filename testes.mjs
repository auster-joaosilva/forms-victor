/* Bateria de testes de preenchimento — caça falhas, não mede distribuição.
 *
 * A varredura mede onde os casos caem. Esta bateria pergunta outra coisa:
 * existe preenchimento válido que produza tela quebrada, texto sem sentido,
 * afirmação que o motor não sustenta, ou contradição entre o que o motor
 * calculou e o que a tela diz?
 *
 * Cada invariante tem nome e explica o que estaria errado se falhasse. Uma
 * falha imprime o preenchimento que a produziu, para reproduzir à mão.
 *
 * Uso:  node testes.mjs [N]        (padrão 20.000 casos por gerador)
 */

import { readFileSync } from 'node:fs';
import { PERGUNTAS, BLOCOS, TIPOS_CLIENTE, FAIXAS_PERCENTUAIS,
         perguntasVisiveis } from './src/perguntas.js';
import { diagnosticar, POSICOES } from './src/motor.js';
import { planoDeAcao } from './src/acoes.js';

// --------------------------------------------------------------------------
// DOM de mentira, para renderizar a tela de verdade e inspecionar o HTML
// --------------------------------------------------------------------------

function abrirPortal() {
  const html = readFileSync('portal.html', 'utf8');
  const script = html.slice(html.indexOf('>', html.indexOf('<script')) + 1,
                            html.lastIndexOf('</script>'));
  const noEl = () => ({ className: '', textContent: '', innerHTML: '', style: {}, value: '',
    classList: { add() {}, remove() {}, toggle() {} }, appendChild() {}, remove() {},
    focus() {}, scrollIntoView() {}, setAttribute() {}, forEach() {},
    closest: () => null, querySelector: () => null, insertAdjacentHTML() {} });
  const app = noEl();
  globalThis.document = { getElementById: id => id === 'app' ? app : noEl(),
    querySelector: () => null, querySelectorAll: () => [], createElement: () => noEl(),
    addEventListener() {}, body: noEl() };
  globalThis.window = globalThis;
  globalThis.location = { search: '' };
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.scrollTo = () => {};
  globalThis.fetch = () => Promise.reject(new Error('sem rede no teste'));
  globalThis.AbortController = class { constructor() { this.signal = {}; } abort() {} };
  globalThis.setTimeout = () => 0;
  globalThis.print = () => {};
  const api = new Function(script + `
    return { R, renderResultado, renderRevisao, campo, problemasNaEtapa,
             respostaLegivel, renderRelatorio, resumoDoPreenchimento,
             app: document.getElementById('app') };`)();
  return { api, app };
}

const { api, app } = abrirPortal();
const renderizar = (respostas, fn) => {
  for (const k of Object.keys(api.R)) delete api.R[k];
  Object.assign(api.R, respostas);
  app.innerHTML = '';
  fn();
  return app.innerHTML;
};

// --------------------------------------------------------------------------
// Geradores de preenchimento
// --------------------------------------------------------------------------

let semente = 20260915;
const rnd = () => { semente = (semente * 1103515245 + 12345) & 0x7fffffff; return semente / 0x7fffffff; };
const escolher = l => l[Math.floor(rnd() * l.length)];

const IDENTIFICACAO = { nomeEmpresa: 'Empresa de Teste', cnpj: '11.222.333/0001-81',
  solicitante: 'Fulano de Tal', email: 'a@b.com', telefone: '(34) 99999-9999' };

/** Preenchimento uniforme: sorteia toda opção com igual chance. Serve para
 *  alcançar combinações raras, não para medir frequência. */
function gerarUniforme(fixos = {}) {
  const r = { ...IDENTIFICACAO, ...fixos };
  // Ponto fixo, não número fixo de passadas. `perguntasVisiveis` é fotografada no
  // início de cada passada, então cada nível de condicional só aparece na seguinte.
  // A cadeia anexo "não sei" -> atividade -> serviço do anexo IV -> fator R tem
  // quatro níveis e ficava com o último em branco com um limite de 4 passadas —
  // o que o navegador não sofre, porque redesenha a cada resposta.
  for (let passada = 0; passada < 12; passada++) {
    const antes = Object.keys(r).length;
    for (const p of perguntasVisiveis(r)) {
      if (r[p.chave] !== undefined) continue;
      if (p.tipo === 'matriz') {
        const m = {};
        for (const l of TIPOS_CLIENTE) m[l.chave] = escolher(FAIXAS_PERCENTUAIS).valor;
        r[p.chave] = m;
      } else if (p.opcoes) {
        r[p.chave] = escolher(p.opcoes).valor;
      } else if (p.tipo === 'consentimento') {
        r[p.chave] = 'sim';
      } else if (p.tipo === 'textarea') {
        r[p.chave] = rnd() < 0.3 ? 'texto livre do respondente' : '';
      }
    }
    if (Object.keys(r).length === antes) break;
  }
  const visiveis = new Set(perguntasVisiveis(r).map(p => p.chave));
  for (const p of PERGUNTAS) if (!visiveis.has(p.chave)) delete r[p.chave];
  return r;
}

/** Preenchimento adversarial: força os extremos de cada campo que decide,
 *  além de combinações que já causaram defeito. */
function gerarAdversarial() {
  const extremos = {
    versaoFormulario: ['sintetico', 'completo'],
    margemLiquida: ['prejuizo', 'acima_30', 'nao_sei'],
    faixaRbt12: ['ate_180k', 'acima_4_8mi', 'de_3_6_4_32mi'],
    pesoFolha: ['nenhuma', 'acima_60'],
    aquisicoesRegimeRegular: ['ate_20', 'acima_80', 'nao_sei'],
    setorDiferenciado: ['nenhum', 'bares_restaurantes', 'hotelaria_parques', 'nao_sei'],
    investimentoPrevisto: ['nao', 'acima_1mi'],
    contratosLongos: ['sem_contratos', 'sem_clausula', 'nao_sei'],
    aquisicoesUsoPessoal: ['nao', 'relevante', 'nao_sei'],
    mercadoriasComST: ['nao', 'maioria', 'nao_sei'],
    debitosTributarios: ['nao', 'sim_aberto', 'nao_sei'],
  };
  const fixos = {};
  for (const [chave, valores] of Object.entries(extremos)) fixos[chave] = escolher(valores);
  // matriz nos extremos: tudo zero, tudo não sei, ou 100% num só tipo
  const modo = escolher(['zerada', 'nao_sei', 'concentrada', 'estourada', 'aleatoria']);
  const m = {};
  for (const l of TIPOS_CLIENTE) {
    m[l.chave] = modo === 'zerada' ? 'zero'
      : modo === 'nao_sei' ? 'nao_sei'
      : modo === 'estourada' ? 'acima_80'
      : escolher(FAIXAS_PERCENTUAIS).valor;
  }
  if (modo === 'concentrada') {
    for (const l of TIPOS_CLIENTE) m[l.chave] = 'zero';
    m[escolher(TIPOS_CLIENTE).chave] = 'acima_80';
  }
  fixos.receitaPorCliente = m;
  return gerarUniforme(fixos);
}

// --------------------------------------------------------------------------
// Invariantes
// --------------------------------------------------------------------------

const PALAVRAS_DE_MERITO = [
  'sai mais barato', 'sairia mais caro', 'margem aguenta', 'aguenta esse desconto',
  'mais barato do que', 'mais caro do que', 'sai mais barata', 'sairia mais barato',
];

/** A mesma frase pode aparecer NEGADA, como ressalva: "não serve para concluir
 *  qual regime sai mais barato". Isso é o oposto de afirmar. Antes de acusar,
 *  olho os 90 caracteres anteriores procurando marca de negação. */
const NEGACAO = /não serve|não significa|não é|não para|nem para|é conta|não diz|nunca|deixa de|sem conta|não permite/i;
function afirmaMerito(texto) {
  const t = texto.toLowerCase();
  for (const frase of PALAVRAS_DE_MERITO) {
    let i = t.indexOf(frase);
    while (i >= 0) {
      // A negação pode vir antes ("não serve para concluir qual sai mais barato")
      // ou depois ("qual sai mais barata é conta, não leitura de perfil").
      const volta = texto.slice(Math.max(0, i - 90), i);
      const segue = texto.slice(i + frase.length, i + frase.length + 70);
      if (!NEGACAO.test(volta) && !NEGACAO.test(segue)) return frase;
      i = t.indexOf(frase, i + 1);
    }
  }
  return null;
}

/** Identificador de código vazando para texto de cliente: camelCase ou
 *  snake_case com underline. "IBS", "CBS", "DAS", "MEI" são siglas, não código. */
const VAZAMENTO_DE_JARGAO = /\b(?:[a-z]+[A-Z][a-zA-Z]*|[a-z]{3,}_[a-z_]{3,})\b/;

const INVARIANTES = [
  { nome: 'diagnostico nao lanca',
    porque: 'preenchimento valido travando o motor = tela branca para o respondente',
    checar: ({ d }) => !!d },

  { nome: 'saida tem os quatro textos',
    porque: 'saida sem titulo, resumo, significa ou modalidade renderiza vazio',
    checar: ({ d }) => d.saida.titulo && d.saida.resumo && d.saida.significa && d.saida.modalidade },

  { nome: 'posicao pertence ao catalogo',
    porque: 'posicao improvisada nao tem cor nem qualificador na tela',
    checar: ({ d }) => Object.values(POSICOES).some(x => x.rotulo === d.posicao.rotulo) },

  { nome: 'certeza fechada implica zero pontos em aberto',
    porque: 'dizer "decisao fechada" listando pendencia é contradicao na mesma tela',
    checar: ({ d }) => d.posicao.certeza !== 'fechada' || (d.posicao.pontosEmAberto || []).length === 0 },

  { nome: 'certeza aberta nomeia ao menos um ponto',
    porque: 'dizer "a confirmar" sem dizer o que confirmar joga a tarefa no respondente',
    checar: ({ d }) => d.posicao.certeza !== 'aberta'
      || d.posicao.familia === 'a_definir'
      || (d.posicao.pontosEmAberto || []).length > 0 },

  { nome: 'confianca ALTA implica zero lacunas',
    porque: 'confianca alta com lacuna e afirmacao falsa sobre a propria leitura',
    checar: ({ d }) => d.confianca.nivel !== 'ALTA' || d.confianca.lacunas.length === 0 },

  { nome: 'lacunas e rotulos legiveis andam juntos',
    porque: 'a tela imprime os rotulos; desalinhamento mostra o campo errado',
    checar: ({ d }) => d.confianca.lacunas.length === d.confianca.lacunasLegiveis.length },

  { nome: 'nenhum rotulo de lacuna vaza nome de campo',
    porque: 'receitaPorCliente.orgao_publico na tela e dialogo interno, nao resposta',
    checar: ({ d }) => !d.confianca.lacunasLegiveis.some(l => VAZAMENTO_DE_JARGAO.test(l)) },

  { nome: 'receita creditavel indefinida leva a saida de lacuna',
    porque: 'sem saber a carteira, qualquer galho da arvore e chute',
    // Gate tem precedencia legitima: quem esta acima do teto ou com margem
    // critica recebe a saida do gate, e nao a de lacuna.
    checar: ({ d }) => d.derivadas.receitaCreditavel !== null
      || d.gatilhos.some(g => g.startsWith('gate_'))
      || d.saida.codigo === 'E' } ,

  { nome: 'radar dentro de 0 a 100 ou nulo',
    porque: 'barra do radar usa o score como largura; fora da faixa estoura o quadro',
    checar: ({ d }) => d.radar.every(e => e.score === null || (e.score >= 0 && e.score <= 100)) },

  { nome: 'plano tem ao menos um item',
    porque: 'relatorio sem nenhuma acao nao justifica o tempo de preenchimento',
    checar: ({ plano }) => plano.total > 0 },

  { nome: 'toda acao tem executor e trilha validos',
    porque: 'item sem executor vaza venda para a lista de tarefas do cliente',
    checar: ({ plano }) => [...plano.clienteAgora, ...plano.clienteDepois, ...plano.auster]
      .every(i => i.acao && i.porque && [1, 2].includes(i.trilha)) },

  { nome: 'acao da Auster nunca aparece como tarefa do cliente',
    porque: 'e a separacao estrutural que o projeto promete',
    checar: ({ plano }) => [...plano.clienteAgora, ...plano.clienteDepois]
      .every(i => i.executor === 'cliente') },

  { nome: 'familia hibrido traz a janela de novembro',
    porque: 'recomendar optar sem dizer que da para cancelar e esconder a protecao',
    checar: ({ d, htmlResultado }) => d.posicao.familia !== 'hibrido'
      || htmlResultado.includes('30 de novembro') },

  { nome: 'nenhuma afirmacao de merito economico na tela',
    porque: 'o motor nao calcula custo; afirmar qual sai mais barato e conclusao sem conta',
    checar: ({ htmlResultado }) => afirmaMerito(htmlResultado) === null },

  { nome: 'tela sem undefined, null ou NaN',
    porque: 'e o sintoma classico de campo novo que a tela ainda nao sabe formatar',
    checar: ({ htmlResultado }) => !/\b(undefined|NaN)\b/.test(htmlResultado)
      && !/>\s*null\s*</.test(htmlResultado) },

  { nome: 'conferencia lista todas as perguntas visiveis',
    porque: 'resposta fora da conferencia nao pode ser corrigida antes do resultado',
    checar: ({ r, htmlRevisao }) => {
      const visiveis = perguntasVisiveis(r).length;
      return (htmlRevisao.match(/class="rev-linha"/g) || []).length === visiveis;
    } },

  { nome: 'conferencia nao mostra resposta vazia em campo obrigatorio',
    porque: 'campo obrigatorio em branco na conferencia significa validacao furada',
    checar: ({ r }) => {
      Object.assign(api.R, r);
      return perguntasVisiveis(r)
        .filter(p => p.obrigatoria !== 'nunca')
        .every(p => api.respostaLegivel(p) !== null);
    } },

  { nome: 'MEI e nao optante nunca chegam ao relatorio',
    porque: 'quem nao tem a escolha nao deve receber recomendacao de modalidade',
    checar: ({ d }) => (d.saida.codigo !== 'ESPECIAL-MEI'
        && d.saida.codigo !== 'ESPECIAL-FORA-DO-SIMPLES')
      || d.posicao.rotulo === POSICOES.nao_se_aplica.rotulo },

  { nome: 'bar ou restaurante fora do regime nao recebe o gate do credito vedado',
    porque: 'refeicao coletiva B2B esta fora do regime (art. 273, § 2º) e o cliente dela credita',
    checar: ({ r, d }) => !(r.setorDiferenciado === 'bares_restaurantes'
        && ['parte_fora_do_regime', 'maior_parte_fora'].includes(r.composicaoAlimentacao))
      || d.saida.codigo !== 'ESPECIAL-SETOR-SEM-CREDITO' },

  { nome: 'relatorio tem todas as folhas',
    porque: 'folha faltando no documento = seção que o cliente leva em branco',
    checar: ({ htmlRelatorio, plano }) => {
      const folhas = (htmlRelatorio.match(/class="folha/g) || []).length;
      // capa, significa, plano, resumo, ressalvas = 5; mais a da Auster quando há
      return folhas === (plano.auster.length ? 6 : 5);
    } },

  { nome: 'relatorio sem undefined, NaN ou null',
    porque: 'o documento vai impresso para a mão do cliente; não dá para corrigir depois',
    checar: ({ htmlRelatorio }) => !/\b(undefined|NaN)\b/.test(htmlRelatorio)
      && !/>\s*null\s*</.test(htmlRelatorio) },

  { nome: 'relatorio nao afirma merito economico',
    porque: 'impresso, a afirmação sem conta circula sem contexto',
    checar: ({ htmlRelatorio }) => afirmaMerito(htmlRelatorio) === null },

  { nome: 'resumo do preenchimento cobre as perguntas de escolha',
    porque: 'o cliente leva no papel o que declarou; falta de resposta é conferência impossível',
    checar: ({ r, htmlRelatorio }) => {
      const esperadas = perguntasVisiveis(r)
        .filter(p => p.tipo !== 'consentimento' && p.tipo !== 'textarea').length;
      return (htmlRelatorio.match(/<tr><td class="p">/g) || []).length === esperadas;
    } },

  { nome: 'relatorio traz protocolo',
    porque: 'documento sem protocolo não se liga à resposta que a casa recebeu',
    checar: ({ htmlRelatorio }) => /DS-\d{6}-[A-Z0-9]{4}/.test(htmlRelatorio) },

  { nome: 'validacao aceita o preenchimento gerado',
    porque: 'o gerador respeita as condicionais; recusa aqui = condicional inconsistente',
    checar: ({ r }) => {
      for (const b of BLOCOS) {
        Object.assign(api.R, r);
        if (Object.keys(api.problemasNaEtapa(b.numero)).length) return false;
      }
      return true;
    } },
];

// --------------------------------------------------------------------------
// Execução
// --------------------------------------------------------------------------

const n = Number(process.argv[2] || 20000);
const hoje = new Date('2026-09-15T10:00:00');
const falhas = new Map();
let rodados = 0, erros = 0;

function rodar(gerador, rotulo) {
  for (let i = 0; i < n; i++) {
    const r = gerador();
    let caso;
    try {
      const d = diagnosticar(r, hoje);
      const plano = planoDeAcao(r, d);
      const htmlResultado = renderizar(r, api.renderResultado);
      const htmlRevisao = renderizar(r, api.renderRevisao);
      const htmlRelatorio = renderizar(r, api.renderRelatorio);
      caso = { r, d, plano, htmlResultado, htmlRevisao, htmlRelatorio };
    } catch (e) {
      erros++;
      registrar('EXCECAO: ' + e.message, rotulo, r);
      continue;
    }
    rodados++;
    for (const inv of INVARIANTES) {
      let ok;
      try { ok = inv.checar(caso); }
      catch (e) { ok = false; }
      if (!ok) registrar(inv.nome, rotulo, r, inv.porque);
    }
  }
}

function registrar(nome, gerador, r, porque) {
  if (!falhas.has(nome)) falhas.set(nome, { n: 0, porque, exemplo: r, gerador });
  falhas.get(nome).n++;
}

const resumo = r => {
  const m = r.receitaPorCliente || {};
  return [`versao=${r.versaoFormulario}`, `segmento=${r.segmento}`, `anexo=${r.anexoSimples}`,
          `faixa=${r.faixaRbt12}`, `margem=${r.margemLiquida}`, `folha=${r.pesoFolha}`,
          `setor=${r.setorDiferenciado}`, `alim=${r.composicaoAlimentacao}`,
          `matriz=${Object.entries(m).map(([k, v]) => k.slice(0, 4) + ':' + v).join(' ')}`]
    .filter(x => !x.endsWith('undefined')).join(' · ');
};

console.log(`\nBateria de preenchimento — ${(2 * n).toLocaleString('pt-BR')} casos`);
console.log(`${INVARIANTES.length} invariantes · ${PERGUNTAS.length} perguntas no formulário\n`);

rodar(gerarUniforme, 'uniforme');
rodar(gerarAdversarial, 'adversarial');

console.log(`casos completos: ${rodados.toLocaleString('pt-BR')}`);
console.log(`exceções: ${erros}`);
console.log(`invariantes violadas: ${falhas.size}\n`);

if (falhas.size === 0) {
  console.log('Nenhuma falha. As ' + INVARIANTES.length + ' invariantes se mantiveram em todos os casos.\n');
  process.exit(0);
}

for (const [nome, f] of [...falhas.entries()].sort((a, b) => b[1].n - a[1].n)) {
  console.log(`FALHA · ${nome}  (${f.n} casos, gerador ${f.gerador})`);
  if (f.porque) console.log(`  por que importa: ${f.porque}`);
  console.log(`  exemplo: ${resumo(f.exemplo)}`);
  // Com --json, imprime o preenchimento inteiro para reproduzir a falha à mão.
  if (process.argv.includes('--json')) console.log('  preenchimento: ' + JSON.stringify(f.exemplo));
  console.log('');}
process.exit(1);
