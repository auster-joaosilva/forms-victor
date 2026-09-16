/* Motor de decisão — padrão x híbrido.
 *
 * Função pura: entram as respostas, sai o diagnóstico. Sem rede, sem estado,
 * sem efeito colateral. Espelha MANUAL-DECISAO.md §7.
 *
 * Divergências deliberadas do manual estão marcadas com [DIVERGE] e listadas
 * no README. Cortes de calibragem ficam isolados em CORTES, para que ajustar
 * seja editar um objeto — nunca caçar número no meio da lógica.
 */

import { PERGUNTAS, EIXOS_RADAR, perguntasVisiveis, pontoMedioFaixa,
         linhasMatrizSemResposta } from './perguntas.js';
import { estimarAliquotaDas, conferirAliquotaDeclarada } from './simples.js';

// --------------------------------------------------------------------------
// Parâmetros de calibragem — §12 do manual, todos marcados [CALIBRAR]
// --------------------------------------------------------------------------

export const CORTES = {
  receitaCreditavelBaixa: 20,      // [CALIBRAR] abaixo disto → SAÍDA A
  receitaCreditavelAlta: 60,       // [CALIBRAR] acima disto → ramo de venda entre empresas
  densidadeCreditoMinima: 40,      // [CALIBRAR] piso para recomendar optar
  margemMinimaSuporta: 'de_10_20', // [CALIBRAR] deveria ser setorial (§12.3)
  fatorFolha: {                    // [CALIBRAR] ajuste de densidade por folha
    nenhuma: 1.00,                 // sem folha, todo custo passa por terceiro
    ate_15: 1.00, de_15_30: 0.90, de_30_45: 0.75,
    de_45_60: 0.60, acima_60: 0.45,
  },
  // [CALIBRAR] Aquisição de uso ou consumo pessoal não gera crédito
  // (LC 214/2025, art. 47, caput, c/c art. 57). "Não sei" NÃO penaliza: a
  // lacuna entra na confiança e vira ação, não vira o pior caso.
  fatorUsoPessoal: {
    nao: 1.00, pouco: 0.90, relevante: 0.75, nao_sei: 1.00,
  },
  // [CALIBRAR] pagamento a PJ gera crédito; folha não.
  fatorPrestadorPJ: {
    nao: 1.00, alguns: 1.10, boa_parte: 1.25, nao_sei: 1.00,
  },
};

/** [DIVERGE-D1] O manual manda SAÍDA C sempre que receitaCreditavel > 60% e a
 *  empresa não está perto do teto, SEM olhar densidade de crédito — o que
 *  contraria a própria aritmética da § 3 do manual: recomendar apurar por fora a
 *  quem não tem crédito próprio é recomendar pagar mais.
 *
 *  LIGADA em 15/09/2026, por decisão da direção após a revisão externa. O ramo
 *  alto passa a testar densidade igual ao ramo intermediário. O portal deixa de
 *  ser fiel ao manual nesse ponto — de propósito, e registrado. */
export const APLICAR_TESTE_DENSIDADE_NO_RAMO_ALTO = true;

/** Janelas da opção pelo regime regular do IBS e da CBS (o "híbrido").
 *
 *  FONTES CONFERIDAS em 15/09/2026:
 *
 *  1. LC 123/2006, art. 13, § 9º (incluído pela LC 227/2026) e § 10 (redação da
 *     LC 227/2026), no texto do Planalto: a opção "será exercida para os
 *     semestres iniciados em janeiro e julho de cada ano, sendo IRRETRATÁVEL
 *     para cada um desses períodos, devendo ser exercida nos meses de setembro e
 *     março imediatamente anteriores a cada semestre, NA FORMA REGULAMENTADA
 *     PELO CGSN".
 *
 *  2. "Manual da Opção pelo Regime Regular do IBS e da CBS no Simples Nacional",
 *     Secretaria-Executiva do CGSN, publicado em 01/09/2026, item 4.2: "Em 2026,
 *     por exemplo, poderá cancelar a opção pelo regime regular para o primeiro
 *     semestre de 2027 ATÉ 30/11/2026, em caráter irretratável." A tela de
 *     ciência do sistema confirma: depois desse prazo, "somente poderei
 *     renunciar ao regime regular nas próximas janelas semestrais de março e
 *     setembro". Base legal citada pela RFB: LC 214/2025 e Resoluções CGSN
 *     186, 190 e 191, de 2026.
 *
 *  Como as duas se conciliam: o § 10 fecha o SEMESTRE, e o regulamento do CGSN
 *  abre uma janela de desistência da SOLICITAÇÃO antes de os efeitos começarem.
 *
 *  HISTÓRICO: em 15/09/2026 eu removi o cancelamento de novembro deste arquivo,
 *  por não o encontrar na lei. Estava errado — ele está no regulamento, para o
 *  qual a própria lei remete. Reposto no mesmo dia, com as duas fontes acima.
 *  A assimetria que decide: perder setembro custa um semestre e NÃO se recupera;
 *  optar e se arrepender se resolve até 30/11 sem custo. */
export const PRAZO = {
  fimDaJanela: '2026-09-30',          // último dia do mês de setembro de 2026
  desistenciaAte: '2026-11-30',       // cancelamento da solicitação, item 4.2 do manual
  semestreDeEfeito: '1º semestre de 2027',
  janelaSeguinte: 'março de 2027',
  efeitoDaJanelaSeguinte: '2º semestre de 2027',
  // Antecedência operacional pedida pela própria casa: representação, análise
  // prévia do sistema (que atualiza uma vez por dia) e eventual pendência de
  // Estado ou Município não cabem no último dia. NÃO é prazo legal.
  folgaProtocoloDias: 3,   // dias úteis reservados para operacionalizar
};

const ORDEM_MARGEM = ['prejuizo', 'ate_5', 'de_5_10', 'de_10_20', 'de_20_30', 'acima_30'];

/** Presunções do Lucro Presumido por segmento, transcritas de
 *  `Triagem_Reforma_Tributaria/01_Parametros/triagem_aliquotas.toml` (Lei
 *  9.249/1995, arts. 15 e 20).
 *
 *  CORRIGIDO 15/09/2026. Antes havia só dois valores — 11,33% para "serviço" e
 *  5,93% para "produto" — e TODO segmento que não fosse comércio, indústria ou
 *  agronegócio caía em 11,33%. Transporte de carga e serviço hospitalar ficavam
 *  quase o dobro do devido, o que empurrava o gatilho
 *  `simples_pode_estar_mais_caro` para o lado errado. */
const PRESUNCOES = {
  comercio:               { irpj: 0.08, csll: 0.12, fonte: 'art. 15, caput, e art. 20, III' },
  industria:              { irpj: 0.08, csll: 0.12, fonte: 'art. 15, caput, e art. 20, III' },
  agronegocio:            { irpj: 0.08, csll: 0.12, fonte: 'art. 15, caput, e art. 20, III' },
  transporte_carga:       { irpj: 0.08, csll: 0.12, fonte: "art. 15, § 1º, II, 'a', parte final" },
  transporte_passageiros: { irpj: 0.16, csll: 0.12, fonte: "art. 15, § 1º, II, 'a'" },
  // Volta ao caput SOMENTE se for sociedade empresária E atender às normas da
  // Anvisa — condições de fato, não de CNAE. Sem as duas, serviços em geral.
  servico_saude:          { irpj: 0.08, csll: 0.12, fonte: "art. 15, § 1º, III, 'a', a contrario",
                            exigeConfirmacao: 'servicoHospitalar' },
  servico_demais:         { irpj: 0.32, csll: 0.32, fonte: "art. 15, § 1º, III, 'a'" },
  // [CONFERIR] Empreitada com fornecimento de material tende ao caput (8%) e
  // só mão de obra aos 32%. A distinção NÃO está conferida no
  // triagem_aliquotas.toml, então fica no valor mais alto — que é o conservador
  // aqui: faz o Presumido parecer pior, nunca melhor do que é.
  construcao_civil:       { irpj: 0.32, csll: 0.32, fonte: '[CONFERIR] presunção da empreitada' },
  outro:                  { irpj: 0.32, csll: 0.32, fonte: "art. 15, § 1º, III, 'a'" },
};

/** PIS/COFINS cumulativo. [DECIDIR] Este 3,65% é base 2026. A partir de
 *  1º/01/2027 a matriz legal do PIS e da COFINS é revogada (LC 214, art. 542,
 *  III, IX, X, XVIII e XXI, c/c art. 544, III) e entra a CBS cheia. A comparação
 *  atual portanto mistura épocas: DAS de hoje contra Presumido de hoje, para uma
 *  opção que produz efeito em 2027. Mantive a base 2026 de propósito — é a que o
 *  respondente consegue conferir no próprio PGDAS — e a saída continua sendo
 *  "vale analisar", nunca "migre". Trocar a base é decisão da direção. */
const PIS_COFINS_CUMULATIVO = 3.65;

/** Carga federal do Presumido para o segmento respondido, em % da receita.
 *  São só os federais: a alíquota do Simples já embute ISS ou ICMS e a CPP, por
 *  isso o motor soma as estimativas dessas parcelas antes de comparar. */
function cargaFederalPresumido(r) {
  let pres = PRESUNCOES[r.segmento] || PRESUNCOES.servico_demais;
  // Presunção condicionada e não confirmada cai para serviços em geral.
  if (pres.exigeConfirmacao && r[pres.exigeConfirmacao] !== 'sim') pres = PRESUNCOES.servico_demais;
  return { pct: +(100 * (0.15 * pres.irpj + 0.09 * pres.csll) + PIS_COFINS_CUMULATIVO).toFixed(2),
           irpj: pres.irpj, csll: pres.csll, fonte: pres.fonte };
}
const CPP_SOBRE_FOLHA = 0.268;          // 20% + RAT + terceiros [CONFERIR]
const PONTO_MEDIO_FOLHA = { nenhuma: 0, ate_15: 7.5, de_15_30: 22.5, de_30_45: 37.5,
                            de_45_60: 52.5, acima_60: 70 };
const ISS_ICMS_ESTIMADO = { servico: 3.5, produto: 4.0 };  // [CALIBRAR] varia por município e UF
const PONTO_MEDIO_DAS = { ate_6: 5, de_6_9: 7.5, de_9_12: 10.5,
                          de_12_15: 13.5, de_15_19: 17, acima_19: 21 };
const ORDEM_RBT12 = ['ate_180k', 'de_180_360k', 'de_360_720k', 'de_720k_1_8mi',
                     'de_1_8_3_6mi', 'de_3_6_4_32mi', 'de_4_32_4_8mi', 'acima_4_8mi'];

const idx = (lista, v) => lista.indexOf(v);

// --------------------------------------------------------------------------
// Variáveis derivadas — §7.1
// --------------------------------------------------------------------------

export function derivadas(r) {
  const m = r.receitaPorCliente || {};

  /** [DIVERGE-D5] A receita creditavel e a unica variavel que sozinha decide o
   *  primeiro galho da arvore. Se o respondente marcou "nao sei" na linha do
   *  regime regular ou do orgao publico, ela fica indefinida — NUNCA zero. Zero
   *  mandaria "continue como esta" para quem so nao conhece a propria carteira. */
  const pmRegular = pontoMedioFaixa(m.regime_regular);
  const pmPublico = pontoMedioFaixa(m.orgao_publico);
  const pmExterior = pontoMedioFaixa(m.exterior);
  const mixIndefinido = pmRegular === null;
  // Qualquer linha da matriz em "não sei" — não só as duas que decidem — diz que a
  // carteira não está mapeada, e isso vira ação do cliente.
  const carteiraNaoMapeada = ['pessoa_fisica', 'simples_mei', 'regime_regular',
                              'orgao_publico', 'exterior'].some(k => m[k] === 'nao_sei');
  /** CORRIGIDO 15/09/2026. A versão anterior somava metade do peso do órgão
   *  público à receita creditável. Esse 0,5 não tinha fundamento: órgão público
   *  em regra não aproveita crédito, e a venda a governo tem regra própria na
   *  LC 214. Agora só entra a receita destinada a empresa do regime regular; a
   *  venda a órgão público e a exportação viraram alertas com ação própria. */
  const receitaCreditavel = mixIndefinido ? null : pmRegular;
  const vendeParaOrgaoPublico = pmPublico !== null && pmPublico > 0;
  const exporta = pmExterior !== null && pmExterior > 0;

  /** [DIVERGE-D2] O manual usa ponto médio de aquisicoesRegimeRegular sem dizer
   *  o que fazer com "Não sei", que não tem ponto médio. Aqui "Não sei" devolve
   *  null e a densidade fica indefinida — a lacuna não vira zero. */
  const pmAquisicoes = {
    ate_20: 10, de_20_40: 30, de_40_60: 50, de_60_80: 70, acima_80: 90,
  }[r.aquisicoesRegimeRegular];

  /** O fator de folha e o peso das mercadorias medem a MESMA coisa por lados
   *  opostos: quanto do custo passa por terceiro e portanto pode gerar crédito.
   *  Multiplicar os dois contaria o efeito duas vezes. Quando a empresa opera com
   *  produto e respondeu `pesoMercadorias`, ele SUBSTITUI o fator de folha — é a
   *  medida direta, não o proxy. Serviço puro continua no fator de folha.
   *  [CALIBRAR] a conversão do peso de mercadorias em fator. */
  const PESO_MERCADORIAS_COMO_FATOR = { ate_20: 0.45, de_20_40: 0.60,
                                        de_40_60: 0.75, de_60_80: 0.90, acima_80: 1.00 };
  const fator = PESO_MERCADORIAS_COMO_FATOR[r.pesoMercadorias]
    ?? CORTES.fatorFolha[r.pesoFolha] ?? 1;
  const fatorPessoal = CORTES.fatorUsoPessoal[r.aquisicoesUsoPessoal] ?? 1;
  // Prestador PJ gera crédito onde a folha não gera — devolve parte do que o
  // fator de folha tirou. [CALIBRAR]
  const fatorPrestadorPJ = CORTES.fatorPrestadorPJ[r.prestadoresPJ] ?? 1;
  const densidadeCredito = pmAquisicoes === undefined
    ? null : Math.min(100, pmAquisicoes * fator * fatorPessoal * fatorPrestadorPJ);

  const margemConhecida = r.margemLiquida && r.margemLiquida !== 'nao_sei';
  const margemSuporta = margemConhecida
    && idx(ORDEM_MARGEM, r.margemLiquida) >= idx(ORDEM_MARGEM, CORTES.margemMinimaSuporta)
    && r.contratosLongos !== 'sem_clausula';

  const iRbt = idx(ORDEM_RBT12, r.faixaRbt12);
  /** CORRIGIDO 15/09/2026. `ultrapassouSublimite === 'sim_corrente'` entrava aqui
   *  e levava à SAÍDA D — "vale continuar no Simples?" — confundindo duas coisas
   *  distintas: o SUBLIMITE de R$ 3,6 mi, que muda onde se recolhem ICMS, ISS e
   *  IBS, e o LIMITE de R$ 4,8 mi, que é o de permanência no regime. Passar do
   *  sublimite não tira ninguém do Simples. Virou alerta próprio. */
  const proximoDoTeto =
    iRbt >= idx(ORDEM_RBT12, 'de_4_32_4_8mi')
    || (iRbt >= idx(ORDEM_RBT12, 'de_3_6_4_32mi') && r.tendenciaCrescimento === 'cresce_acima_20');
  const passouDoSublimite = ['sim_corrente', 'sim_anteriores'].includes(r.ultrapassouSublimite);

  // --- tese de mudança de regime: só gera RECOMENDAÇÃO DE ANÁLISE ---
  const natureza = ['i', 'ii'].includes(r.anexoSimples) ? 'produto'
    : ['iii', 'iv', 'v'].includes(r.anexoSimples) ? 'servico'
    : ['comercio', 'industria', 'agronegocio'].includes(r.segmento) ? 'produto' : 'servico';
  const presumido = cargaFederalPresumido(r);
  // Prioridade: alíquota informada pelo cliente; na falta dela, a estimativa
  // pela tabela do anexo. Só se nenhuma existir a comparação fica indefinida.
  const estimativa = estimarAliquotaDas(r.anexoSimples, r.faixaRbt12);
  const dasInformado = PONTO_MEDIO_DAS[r.aliquotaEfetivaDas] ?? null;
  const dasEstimado = dasInformado !== null ? dasInformado
    : estimativa ? estimativa.medio + (estimativa.issIcmsForaDoDas ? ISS_ICMS_ESTIMADO[natureza] : 0)
    : null;
  /* Porteira de coerencia (B5): a declaracao continua valendo, mas quando ela
     nao sobrepoe o intervalo da tabela, uma das informacoes esta errada — a
     faixa de receita, o anexo ou a propria aliquota. Isso tem de aparecer em
     vez de contaminar a conta em silencio. */
  const conferenciaDas = conferirAliquotaDeclarada(r);
  const origemDoDas = dasInformado === null
    ? (estimativa ? 'estimado pela tabela do anexo' : 'indisponível')
    : conferenciaDas.situacao === 'coerente' ? 'informado, dentro do estimado'
    : conferenciaDas.situacao === 'fora_do_intervalo' ? 'informado, FORA do estimado'
    : 'informado, sem tabela conferida para comparar';
  const cppEstimada = (PONTO_MEDIO_FOLHA[r.pesoFolha] ?? 0) * CPP_SOBRE_FOLHA;
  // No Anexo IV a CPP já está fora do DAS, então não se soma de novo ao Presumido.
  const cppQueSomaAoPresumido = r.anexoSimples === 'iv' ? 0 : cppEstimada;
  const cargaPresumidoEstimada = presumido.pct
    + cppQueSomaAoPresumido + ISS_ICMS_ESTIMADO[natureza];
  const simplesParecelMaisCaro = dasEstimado !== null
    && dasEstimado > cargaPresumidoEstimada;
  /** Margem real abaixo da presunção de IRPJ é o indício clássico de que o Lucro
   *  REAL pode custar menos que o Presumido — no Real se tributa o lucro que
   *  existe, e não um lucro presumido maior do que ele.
   *
   *  CORRIGIDO 15/09/2026. A versão anterior decidia por `natureza`
   *  (produto x serviço) com faixas fixas, o que ficou inconsistente quando as
   *  presunções passaram a variar por segmento: transporte de carga e serviço
   *  hospitalar presumem 8%, mas caíam na regra de serviço e disparavam o gatilho
   *  com margem de até 30%. Agora compara com a presunção do próprio segmento. */
  const TETO_DA_FAIXA_DE_MARGEM = { prejuizo: 0, ate_5: 5, de_5_10: 10,
                                    de_10_20: 20, de_20_30: 30, acima_30: null };
  const tetoMargem = TETO_DA_FAIXA_DE_MARGEM[r.margemLiquida];
  const presuncaoIrpjPct = 100 * presumido.irpj;
  const margemAbaixoDaPresuncao = tetoMargem !== null && tetoMargem !== undefined
    && tetoMargem <= presuncaoIrpjPct;

  const setorComTratamentoProprio = r.setorDiferenciado
    && !['nenhum', 'nao_sei'].includes(r.setorDiferenciado);
  /** A lei VEDA o crédito a quem compra desses setores: art. 276 (bares,
   *  restaurantes e lanchonetes) e art. 283 (hotelaria, parques de diversão e
   *  parques temáticos) da LC 214/2025. Conferido no texto em 15/09/2026.
   *  Sem crédito para o cliente, o argumento central deste diagnóstico — destacar
   *  imposto para o cliente aproveitar — simplesmente não existe. */
  /** CORRIGIDO 15/09/2026, art. 273, § 2º conferido no texto: o regime
   *  específico de bares e restaurantes NÃO alcança alimentação para pessoa
   *  jurídica sob contrato, revenda de produto de terceiro sem preparo nem bebida
   *  alcoólica. Quem vive de refeição coletiva para empresa está FORA do regime e cai na
   *  regra geral — o cliente dele APROVEITA crédito. Antes, o marcador de setor
   *  bastava para acionar o gate, e esses casos recebiam recomendação errada por
   *  enquadramento. Hotelaria segue sem exclusão análoga (art. 283 é geral). */
  const fatiaFora = r.composicaoAlimentacao;
  const barOuRestauranteNoRegime = r.setorDiferenciado === 'bares_restaurantes'
    && !['maior_parte_fora', 'parte_fora_do_regime'].includes(fatiaFora);
  const clienteNaoPodeCreditar =
    barOuRestauranteNoRegime || r.setorDiferenciado === 'hotelaria_parques';
  const receitaMistaNoRegimeEspecifico = r.setorDiferenciado === 'bares_restaurantes'
    && ['parte_fora_do_regime', 'maior_parte_fora', 'nao_sei'].includes(fatiaFora);

  return { receitaCreditavel, mixIndefinido, carteiraNaoMapeada,
           vendeParaOrgaoPublico, exporta,
           densidadeCredito, margemSuporta, proximoDoTeto,
           margemConhecida, passouDoSublimite,
           setorComTratamentoProprio, clienteNaoPodeCreditar,
           receitaMistaNoRegimeEspecifico,
           natureza, dasEstimado,
           origemDoDas, intervaloDas: estimativa,
           conferenciaDas: conferenciaDas.situacao,
           cargaPresumidoEstimada: +cargaPresumidoEstimada.toFixed(1),
           cargaFederalPresumido: presumido.pct, fontePresuncao: presumido.fonte,
           presuncaoIrpjPct,
           simplesParecelMaisCaro, margemAbaixoDaPresuncao };
}

// --------------------------------------------------------------------------
// Confiança — §7.6
// --------------------------------------------------------------------------

export function confianca(r) {
  const visiveis = perguntasVisiveis(r);
  const decide = p => p.alimenta.includes('modalidade') || p.alimenta.includes('elegibilidade');
  const lacunas = [], lacunasLegiveis = [];
  for (const p of visiveis) {
    if (!decide(p) || !p.naoSei) continue;
    // A matriz guarda um objeto: a lacuna está na linha, não no campo.
    if (p.tipo === 'matriz') {
      for (const chaveLinha of linhasMatrizSemResposta(p, r)) {
        lacunas.push(`${p.chave}.${chaveLinha}`);
        const linha = (p.linhas || []).find(l => l.chave === chaveLinha);
        lacunasLegiveis.push(`${p.lacuna || p.enunciado} ${(linha && linha.rotulo) || chaveLinha}`);
      }
    } else if (r[p.chave] === p.naoSei) {
      // Lacuna suprida por tabela conferida não reduz confiança: existe número.
      if (p.lacunaSuprida && p.lacunaSuprida(r)) continue;
      lacunas.push(p.chave);
      // Rótulo curto para a tela: nome de campo é diálogo interno, não resposta a
      // quem preencheu o formulário.
      lacunasLegiveis.push(p.lacuna || p.enunciado);
    }
  }

  let nivel = lacunas.length === 0 ? 'ALTA' : lacunas.length <= 2 ? 'MÉDIA' : 'BAIXA';
  // O caminho curto não coleta o suficiente para uma leitura de confiança alta,
  // ainda que nada tenha vindo em branco. Teto de MÉDIA, sempre.
  if (r.versaoFormulario === 'sintetico' && nivel === 'ALTA') nivel = 'MÉDIA';
  return { nivel, lacunas, lacunasLegiveis, caminhoCurto: r.versaoFormulario === 'sintetico' };
}

// --------------------------------------------------------------------------
// Gates e árvore — §7.2 e §7.3
// --------------------------------------------------------------------------

/** As posições de regime que o portal pode devolver. É a primeira coisa que o
 *  respondente lê — por isso cada uma diz O QUE FAZER e ATÉ QUANDO, não só o
 *  nome. As três famílias (padrão, híbrido, a definir) nunca se misturam. */
/** `familia` diz QUAL caminho; `certeza` diz se a decisão está fechada.
 *  A cor da tela segue a CERTEZA, não a família: a primeira coisa que o
 *  respondente precisa saber é se aquilo está resolvido ou ainda em aberto.
 *  Pintar "Híbrido como proteção" com a mesma cor de uma decisão fechada dizia,
 *  no visual, o contrário do que o texto dizia. */
export const POSICOES = {
  padrao: {
    familia: 'padrao', certeza: 'fechada', rotulo: 'Simples padrão', qualificador: 'decisão fechada',
    acaoUnica: 'Não há nada a protocolar em setembro. Você continua na guia única.',
    detalhe: 'IBS e CBS seguem sendo recolhidos dentro do DAS.' },
  padrao_a_confirmar: {
    familia: 'padrao', certeza: 'aberta', rotulo: 'Simples padrão', qualificador: 'a confirmar',
    acaoUnica: 'Nada a protocolar em setembro. Antes de fechar o ano, confira o que ficou em aberto abaixo.',
    detalhe: 'IBS e CBS seguem sendo recolhidos dentro do DAS. Se a conferência mudar a leitura, a próxima janela é ' + PRAZO.janelaSeguinte + '.' },
  hibrido_definitivo: {
    familia: 'hibrido', certeza: 'fechada', rotulo: 'Simples híbrido', qualificador: 'decisão fechada',
    acaoUnica: 'Protocole a opção até 30 de setembro de 2026.',
    detalhe: 'O DAS continua para os demais tributos e o IBS e a CBS passam a ser apurados por fora, com direito a crédito. O efeito é no ' + PRAZO.semestreDeEfeito + '.' },
  // A posição de hedge. O nome NÃO pode ser "Simples híbrido" puro: em corpo 46 px
  // isso se lê como a decisão tomada, quando a decisão ainda está aberta e a opção
  // serve de proteção de prazo. O rótulo diz o que o movimento é.
  hibrido_a_confirmar: {
    familia: 'hibrido', certeza: 'aberta', rotulo: 'Híbrido como proteção',
    qualificador: 'a decisão em si continua aberta',
    acaoUnica: 'Protocole a opção até 30 de setembro para não perder a janela, e feche a conta até o início de novembro — se ela disser que não vale, cancele até 30 de novembro.',
    detalhe: 'Optar agora não é escolher o híbrido: é guardar o direito de escolher. O prazo de setembro não volta; a opção feita nele se desfaz até 30 de novembro sem efeito nenhum.' },
  a_definir: {
    familia: 'a_definir', certeza: 'aberta', rotulo: 'Proteja o prazo antes de decidir', qualificador: 'a conta depende de número real',
    acaoUnica: 'Protocole a opção até 30 de setembro para não perder a janela, e decida de verdade até 30 de novembro, com os números na mão.',
    detalhe: 'As respostas não fecham a conta em nenhum dos dois lados. Como a solicitação pode ser cancelada até 30 de novembro e setembro não volta, o movimento barato é optar e conferir depois — desde que a decisão seja retomada mesmo.' },
  setor_sem_credito: {
    familia: 'a_definir', certeza: 'aberta', rotulo: 'Depende do regime do seu setor',
    qualificador: 'o argumento do crédito ao cliente não existe aqui',
    acaoUnica: 'Antes de pensar em guia única ou por fora, é preciso rodar a conta do regime específico do setor.',
    detalhe: 'A alíquota do setor é reduzida em 40% e a lei veda o crédito a quem compra de você. O que sobra para decidir é o crédito das suas próprias compras.' },
  nao_se_aplica: {
    familia: 'a_definir', certeza: 'aberta', rotulo: 'Não se aplica', qualificador: '',
    acaoUnica: 'A escolha entre as duas modalidades não existe neste caso.',
    detalhe: '' },
};

/** Gatilhos que impedem tratar a opção como decisão fechada: cada um muda o
 *  TAMANHO DO CRÉDITO de IBS e CBS, que é o objeto desta decisão.
 *
 *  De propósito FORA desta lista: 'simples_pode_estar_mais_caro' e
 *  'margem_abaixo_da_presuncao'. Os dois são sobre outra decisão — continuar ou
 *  não no Simples — e já geram ação própria. Misturar as duas fazia toda
 *  recomendação virar "a confirmar": na varredura com pesos, "decisão fechada"
 *  aparecia em 0,0% dos casos. */
const ABRE_PONTO_EM_ABERTO = [
  'aliquota_fora_do_estimado',
  'setor_com_tratamento_diferenciado',
  'credito_reduzido_por_uso_pessoal',
  'opera_com_substituicao_tributaria',
  'receita_mista_no_regime_especifico',
];

/** Cada ponto em aberto, escrito para quem preencheu. Dizer "vale conferir o
 *  ponto aberto" sem nomear qual transfere ao respondente a tarefa de adivinhar
 *  o que o motor viu. */
const PONTO_EM_ABERTO_LEGIVEL = {
  aliquota_fora_do_estimado: 'a alíquota efetiva que você informou não bate com a faixa de '
    + 'receita e o anexo declarados — uma das três precisa ser revista antes de fechar a conta',
  setor_com_tratamento_diferenciado:
    'sua atividade está em setor com alíquota reduzida ou regime próprio, e o tamanho dessa redução muda a conta',
  credito_reduzido_por_uso_pessoal:
    'há parcela relevante de compras de uso pessoal em nome da empresa, e ela não gera crédito',
  opera_com_substituicao_tributaria:
    'parte das mercadorias tem substituição tributária hoje, e ela deixa de existir no IBS e na CBS',
  receita_mista_no_regime_especifico:
    'parte do que você vende fica fora do regime próprio de bares e restaurantes, e essa parte segue a regra geral — precisa ser separada',
};

/** Lacunas que travam ESTA decisão. Um "não sei" em pergunta que a árvore do
 *  padrão x híbrido não percorre (sublimite, estudo de regime anterior) reduz a
 *  confiança geral do diagnóstico, mas não impede fechar a posição. */
const LACUNA_QUE_TRAVA_A_DECISAO = [
  'receitaPorCliente.regime_regular', 'receitaPorCliente.orgao_publico',
  'aquisicoesRegimeRegular', 'margemLiquida', 'contratosLongos',
  'aquisicoesUsoPessoal', 'prestadoresPJ',
];

/** A posição de regime, a partir da saída, da confiança e dos pontos em aberto.
 *  Recebe a leitura preliminar para nomear um lado também quando um gate
 *  suspendeu a decisão. */
export function posicaoDeRegime(saida, conf, gatilhos, leitura) {
  /* Divergencia de INFORMACAO vale em qualquer posicao, inclusive nas que a
     arvore fecha por outro motivo: a conclusao "seu setor tem regime proprio"
     nao depende da aliquota do DAS, mas a aliquota inconsistente continua sendo
     algo a corrigir, e some da tela se nao for carregada aqui. Furo encontrado
     por invariante em 16/09/2026, em 170 de 20.000 casos. */
  const INCONSISTENCIA = ['aliquota_fora_do_estimado'];
  const inconsistencias = gatilhos.filter(g => INCONSISTENCIA.includes(g))
    .map(g => PONTO_EM_ABERTO_LEGIVEL[g]).filter(Boolean);

  if (saida.codigo === 'ESPECIAL-SETOR-SEM-CREDITO')
    return { ...POSICOES.setor_sem_credito, pontosEmAberto: inconsistencias };
  if (saida.modalidade === 'nao_se_aplica')
    return { ...POSICOES.nao_se_aplica, pontosEmAberto: inconsistencias };

  const emAberto = gatilhos.filter(g => ABRE_PONTO_EM_ABERTO.includes(g));
  // As lacunas críticas já têm rótulo legível; `lacunas` e `lacunasLegiveis` são
  // paralelos por construção, então filtro pelo índice.
  const lacunasCriticas = conf.lacunas
    .map((l, i) => LACUNA_QUE_TRAVA_A_DECISAO.includes(l) ? conf.lacunasLegiveis[i] : null)
    .filter(Boolean);
  // O caminho curto nunca fecha posição: por construção ele não pergunta o
  // suficiente. Dizer "decisão fechada" ali seria vender certeza que não há.
  const fechada = !lacunasCriticas.length && !emAberto.length && !conf.caminhoCurto;

  const pontos = [
    ...emAberto.map(g => PONTO_EM_ABERTO_LEGIVEL[g]).filter(Boolean),
    ...lacunasCriticas.map(l => `${l} ficou em "não sei"`),
  ];
  if (conf.caminhoCurto) {
    pontos.push('você respondeu o caminho curto, que não cobre tudo o que a conta pede');
  }

  // A posição é constante compartilhada: devolvo uma cópia com os pontos do caso.
  const com = base => ({ ...base, pontosEmAberto: fechada ? [] : pontos });

  if (saida.modalidade === 'padrao')
    return fechada ? com(POSICOES.padrao) : com(POSICOES.padrao_a_confirmar);
  if (saida.modalidade === 'hibrido')
    return fechada ? com(POSICOES.hibrido_definitivo) : com(POSICOES.hibrido_a_confirmar);

  // Gate suspendeu a decisão, mas a árvore tinha lado: mostra o lado, sempre
  // "a confirmar" — nunca como decisão fechada.
  if (leitura && leitura.chaveModalidade === 'hibrido') return com(POSICOES.hibrido_a_confirmar);
  if (leitura && leitura.chaveModalidade === 'padrao') return com(POSICOES.padrao_a_confirmar);
  return com(POSICOES.a_definir);
}

/** Nome da modalidade, na linguagem que o respondente leva para a conversa com
 *  o contador. São os dois caminhos do art. 41, caput e § 3º, da LC 214/2025. */
export const MODALIDADES = {
  padrao: { rotulo: 'Simples padrão',
            detalhe: 'IBS e CBS continuam sendo recolhidos dentro do DAS, na guia única.' },
  hibrido: { rotulo: 'Simples híbrido',
             detalhe: 'O DAS continua para os demais tributos e o IBS e a CBS passam a ser apurados por fora, com direito a crédito.' },
  a_definir: { rotulo: 'A definir na simulação',
               detalhe: 'As respostas não fecham a conta em nenhum dos dois lados. Decidir agora seria apostar.' },
  nao_se_aplica: { rotulo: 'Não se aplica',
                   detalhe: 'A escolha entre as duas modalidades não existe neste caso.' },
};

const SAIDAS = {
  A: { codigo: 'A', titulo: 'Continue como está.',
       resumo: 'Siga recolhendo IBS e CBS dentro do DAS, na guia única.',
       // As frases "sairia mais caro" e "sai mais barato conceder" saíram em
       // 15/09/2026: eram afirmações econômicas que o motor não calcula.
       significa: 'Seus clientes são, na maior parte, consumidor final ou empresas que não aproveitam crédito de imposto. Destacar imposto na nota não daria vantagem nenhuma na sua venda, porque do outro lado não há quem aproveite. Sem esse ganho comercial, sair da guia única só se justificaria pelo crédito das suas próprias compras — e é isso que a simulação mede.',
       modalidade: 'padrao'},
  B: { codigo: 'B', titulo: 'Continue como está, mas resolva o lado comercial.',
       resumo: 'A mudança que você precisa é de contrato e de preço, não de forma de recolher.',
       significa: 'Você tem clientes que aproveitam crédito e vão pedir desconto por isso, e a sua margem está numa faixa que dá espaço para negociar sem apurar por fora. Qual das duas opções sai mais barata é conta, não leitura de perfil — o que este diagnóstico diz é que o seu problema imediato é comercial: não deixar o desconto ser arrancado cliente por cliente em vez de ser política sua.',
       modalidade: 'padrao'},
  C: { codigo: 'C', titulo: 'Vale apurar IBS e CBS por fora do DAS.',
       resumo: 'Sua cadeia é de empresas, e o crédito virou condição para competir.',
       significa: 'Boa parte do que você fatura vai para empresas que aproveitam crédito de imposto. Continuando na guia única, você entrega a elas um crédito menor do que um concorrente entregaria — e a diferença aparece no preço. Apurar por fora corrige isso. A decisão precisa ser confirmada por simulação e protocolada até 30 de setembro.',
       modalidade: 'hibrido'},
  D: { codigo: 'D', titulo: 'A pergunta é maior: vale continuar no Simples?',
       resumo: 'Você está no teto do Simples, ou muito perto dele.',
       significa: 'Antes de escolher como recolher IBS e CBS, é preciso saber se a empresa continua no Simples em 2027. Nesse patamar a comparação certa é entre Simples, Lucro Presumido e Lucro Real — e essa conta muda tudo o que vem depois.',
       modalidade: 'a_definir'},
  E: { codigo: 'E', titulo: 'Não decida sem simular.',
       resumo: 'Suas respostas apontam para lados opostos.',
       significa: 'Há motivo para mudar e motivo para ficar, nas mesmas informações. Isso não é indefinição do formulário: é um caso que depende de número real, não de estimativa. Mas os dois erros não custam igual. Deixar setembro passar e descobrir depois que valia apurar por fora custa um semestre inteiro, e esse prazo não volta: a janela seguinte é março, com efeito só no segundo semestre de 2027. Já optar em setembro e concluir que era melhor ficar se resolve cancelando a solicitação até 30 de novembro, antes de qualquer efeito. Por isso o movimento prudente é proteger o prazo agora e fechar a conta em outubro e novembro.',
       modalidade: 'a_definir'},
  E_SEM_DADO: { codigo: 'E', titulo: 'Falta uma informação para decidir.',
       resumo: 'Sem ela, qualquer recomendação aqui seria chute.',
       significa: 'Você marcou "não sei" em uma resposta que decide o resultado: o tipo de cliente que compra de você, ou a origem das suas compras. Não é problema — são dados que a contabilidade tem, e levantados a leitura sai na hora. O que não dá é deixar setembro passar esperando por eles: a solicitação pode ser cancelada até 30 de novembro, mas o prazo para fazê-la não se recupera.',
       modalidade: 'a_definir' },
  SETOR_SEM_CREDITO: { codigo: 'ESPECIAL-SETOR-SEM-CREDITO',
       titulo: 'Seu cliente não pode aproveitar crédito — por lei.',
       resumo: 'O seu setor tem regime próprio, e nele a lei veda o crédito a quem compra de você.',
       significa: 'Na parte da sua receita que está dentro do regime próprio do setor, a conversa sobre destacar imposto para o cliente aproveitar crédito não se aplica: quem compra alimentação, bebida ou hospedagem está proibido de creditar, esteja você na guia única ou fora dela. Em troca, a alíquota do setor é reduzida em 40%. Sobra uma única pergunta, e ela é de cálculo: o crédito das SUAS compras compensa sair da guia única? Isso depende do regime específico e não sai de um formulário.',
       modalidade: 'a_definir' },
  MEI: { codigo: 'ESPECIAL-MEI', titulo: 'Como MEI, essa escolha não se aplica a você.',
         resumo: 'O MEI não pode apurar IBS e CBS por fora.',
         significa: 'Se seus clientes são empresas e o crédito virou assunto nas negociações, o caminho seria deixar de ser MEI — o que é uma decisão de outro tamanho. Vale conversar antes de qualquer movimento.',
       modalidade: 'nao_se_aplica'},
  FORA: { codigo: 'ESPECIAL-FORA-DO-SIMPLES', titulo: 'Sua empresa não está no Simples.',
          resumo: 'Este diagnóstico trata de quem já é optante.',
          significa: 'A escolha entre recolher IBS e CBS na guia única ou por fora só existe para quem está no Simples. No seu caso a pergunta vem antes: vale ou não entrar no Simples. E o prazo é o mesmo — quem quer ingressar em 2027 precisa pedir entre 1º e 30 de setembro de 2026, e só depois formalizar a escolha do IBS e da CBS. Perdido setembro, a entrada fica para 2028.',
       modalidade: 'nao_se_aplica'},
};

function avaliarGates(r, d) {
  if (r.ehSimei === 'sim') return { saida: SAIDAS.MEI, gatilhos: ['gate_simei'] };
  if (r.regimeAtual && r.regimeAtual !== 'simples')
    return { saida: SAIDAS.FORA, gatilhos: ['gate_fora_do_simples'] };
  if (d.clienteNaoPodeCreditar)
    return { saida: SAIDAS.SETOR_SEM_CREDITO, gatilhos: ['gate_credito_vedado_ao_adquirente'] };
  if (r.faixaRbt12 === 'acima_4_8mi')
    return { saida: SAIDAS.D, gatilhos: ['gate_acima_do_teto'] };
  if (['prejuizo', 'ate_5'].includes(r.margemLiquida))
    return { saida: SAIDAS.E, gatilhos: ['gate_margem_critica'] };
  if (r.investimentoPrevisto === 'acima_1mi')
    return { saida: SAIDAS.E, gatilhos: ['gate_investimento_relevante'] };
  return null;
}

function avaliarArvore(r, d) {
  const gatilhos = [];
  const { receitaCreditavel: rc, densidadeCredito: dc, margemSuporta, proximoDoTeto } = d;

  if (rc === null) {
    gatilhos.push('mix_de_clientes_indefinido');
    return { saida: SAIDAS.E_SEM_DADO, gatilhos };
  }

  if (rc < CORTES.receitaCreditavelBaixa) {
    gatilhos.push('base_b2c');
    return { saida: SAIDAS.A, gatilhos };
  }

  if (rc <= CORTES.receitaCreditavelAlta) {
    gatilhos.push('cadeia_mista');
    if (margemSuporta) { gatilhos.push('margem_absorve_desconto'); return { saida: SAIDAS.B, gatilhos }; }
    gatilhos.push('margem_nao_absorve');
    if (dc === null) { gatilhos.push('densidade_indefinida'); return { saida: SAIDAS.E_SEM_DADO, gatilhos }; }
    if (dc >= CORTES.densidadeCreditoMinima) { gatilhos.push('densidade_suficiente'); return { saida: SAIDAS.C, gatilhos }; }
    gatilhos.push('densidade_insuficiente');
    return { saida: SAIDAS.E, gatilhos };
  }

  gatilhos.push('cadeia_entre_empresas');
  if (proximoDoTeto) { gatilhos.push('proximo_do_teto'); return { saida: SAIDAS.D, gatilhos }; }

  if (APLICAR_TESTE_DENSIDADE_NO_RAMO_ALTO) {
    if (dc === null) { gatilhos.push('densidade_indefinida'); return { saida: SAIDAS.E_SEM_DADO, gatilhos }; }
    if (dc < CORTES.densidadeCreditoMinima) {
      gatilhos.push('densidade_insuficiente_entre_empresas');
      return { saida: SAIDAS.E, gatilhos };
    }
  }
  return { saida: SAIDAS.C, gatilhos };
}

// --------------------------------------------------------------------------
// Urgência e prazo — §7.5
// --------------------------------------------------------------------------

const NIVEIS = ['BAIXA', 'MÉDIA', 'ALTA'];

/** Dias úteis de `de` (exclusive) até `ate` (inclusive).
 *
 *  CORRIGIDO 15/09/2026: a versão anterior testava `d < ate` ANTES de
 *  incrementar, e por isso contava um dia útil depois do fim da janela —
 *  em 15/09 dizia 12 dias úteis onde há 11. O prazo para agir sai do mesmo
 *  número, então o erro inflava os dois. */
function diasUteisEntre(de, ate) {
  let n = 0;
  const d = new Date(de);
  const limite = new Date(ate);
  while (true) {
    d.setDate(d.getDate() + 1);
    if (d > limite) break;
    const s = d.getDay();
    if (s !== 0 && s !== 6) n++;
  }
  return n;
}

/** Recua `n` dias úteis a partir de `data`. */
function recuarDiasUteis(data, n) {
  const d = new Date(data);
  let restam = n;
  while (restam > 0) {
    d.setDate(d.getDate() - 1);
    const s = d.getDay();
    if (s !== 0 && s !== 6) restam--;
  }
  return d;
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
               'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const porExtenso = d => `${d.getDate()} de ${MESES[d.getMonth()]}`;

export function urgenciaEPrazo(saida, r, conf, hoje) {
  let nivel = ['C', 'D', 'E'].includes(saida.codigo) ? 'ALTA'
            : saida.codigo === 'B' ? 'MÉDIA' : 'BAIXA';
  if (r.pressaoCredito === 'perdemos_negocio') nivel = 'ALTA';
  if (conf.nivel === 'BAIXA') nivel = NIVEIS[Math.min(NIVEIS.indexOf(nivel) + 1, 2)];

  const fim = new Date(PRAZO.fimDaJanela + 'T23:59:59');
  const janelaAberta = hoje <= fim;
  const uteisAteFim = janelaAberta ? diasUteisEntre(hoje, fim) : 0;
  // A janela legal é de calendário — "até 30 de setembro" — e é assim que ela
  // aparece na tela. Os dias úteis servem ao cálculo interno do prazo para agir,
  // que reserva a antecedência operacional.
  // Diferença entre DATAS, não entre instantes: em 30/09 às 10h a subtração em
  // milissegundos dava 0,58 dia e arredondava para 1, dizendo "termina amanhã"
  // no último dia da janela.
  const soData = d => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const corridosAteFim = janelaAberta
    ? Math.round((soData(fim) - soData(hoje)) / 86400000) : 0;

  /** [DIVERGE-D4] O manual mandava exibir um "prazo para agir" em dias úteis
   *  (3 para urgência alta). Isso inventava pressão: o prazo real é um só, 30 de
   *  setembro, e o que a casa precisa é de antecedência para operacionalizar.
   *  Em vez de uma contagem, o portal mostra a DATA até a qual protocolar, que é
   *  o fim da janela menos a antecedência operacional. Conceito, não cronómetro. */
  const limite = recuarDiasUteis(new Date(PRAZO.fimDaJanela + 'T12:00:00'),
                                 PRAZO.folgaProtocoloDias);
  const dentroDaAntecedencia = hoje <= limite;

  return { nivel, janelaAberta, uteisAteFim, corridosAteFim,
           dataLimiteProtocolo: porExtenso(limite),
           dentroDaAntecedencia };
}

// --------------------------------------------------------------------------
// Radar — §8, com nota explícita por opção [DIVERGE-D3]
// --------------------------------------------------------------------------

export function radar(r) {
  const visiveis = perguntasVisiveis(r);
  return EIXOS_RADAR.map(eixo => {
    const notas = visiveis
      .filter(p => (p.eixos || []).includes(eixo.numero) && r[p.chave] !== undefined)
      .map(p => (p.opcoes.find(op => op.valor === r[p.chave]) || {}).nota)
      .filter(n => typeof n === 'number');
    const score = notas.length ? Math.round(notas.reduce((a, b) => a + b, 0) / notas.length) : null;
    return { ...eixo, score, faixa: faixaRadar(score), campos: notas.length };
  });
}

export function faixaRadar(s) {
  if (s === null) return 'sem dados';
  return s >= 80 ? 'forte' : s >= 60 ? 'consistente' : s >= 40 ? 'atenção moderada' : 'evolução prioritária';
}

// --------------------------------------------------------------------------
// Leitura preliminar — o que a árvore diria se o gate não tivesse disparado
// --------------------------------------------------------------------------

/** Motivo, em linguagem do respondente, pelo qual a decisão ficou suspensa. */
const CONDICAO_DO_GATE = {
  gate_acima_do_teto: 'depende de a empresa continuar no Simples em 2027',
  gate_margem_critica: 'depende de conferir a margem real, hoje abaixo de 5%',
  gate_investimento_relevante: 'depende de como o investimento previsto entra na conta do crédito',
};

/** Quando um gate suspende a decisão (saídas D e E), devolve a modalidade a que
 *  a carteira do respondente aponta — marcada como condicionada, nunca como
 *  recomendação. Devolve null quando a própria árvore não fecha em um lado. */
function leituraPreliminar(porGate, porArvore) {
  if (!porGate || !['D', 'E'].includes(porGate.saida.codigo)) return null;
  const mod = porArvore.saida.modalidade;
  if (!['padrao', 'hibrido'].includes(mod)) return null;
  const gatilho = porGate.gatilhos[0];
  return {
    modalidade: MODALIDADES[mod],
    chaveModalidade: mod,
    condicao: CONDICAO_DO_GATE[gatilho] || null,
    gatilhos: porArvore.gatilhos,
  };
}

// --------------------------------------------------------------------------
// Entrada única
// --------------------------------------------------------------------------

export function diagnosticar(respostas, hoje = new Date()) {
  const r = respostas || {};
  const d = derivadas(r);
  const conf = confianca(r);

  const porGate = avaliarGates(r, d);
  // A árvore roda SEMPRE, mesmo quando um gate curto-circuita a decisão. Sem
  // isso o portal joga fora a leitura que já tinha: 91% das saídas E vinham de
  // gate (margem crítica ou investimento relevante), e o respondente saía sem
  // nenhuma indicação de modalidade, ainda que a carteira dele fosse clara.
  const porArvore = avaliarArvore(r, d);
  const { saida, gatilhos } = porGate || porArvore;
  const leitura = leituraPreliminar(porGate, porArvore);
  /* B5 — a aliquota declarada nao sobrepoe o intervalo da tabela do anexo: uma
     das tres informacoes esta errada. Vai AQUI, e nao dentro da arvore, porque
     caso resolvido por gate nunca passa por ela — e era assim que o aviso
     desaparecia em 283 de 20.000 casos. */
  if (d.conferenciaDas === 'fora_do_intervalo') gatilhos.push('aliquota_fora_do_estimado');
  if (d.setorComTratamentoProprio) gatilhos.push('setor_com_tratamento_diferenciado');
  if (d.simplesParecelMaisCaro) gatilhos.push('simples_pode_estar_mais_caro');
  if (d.margemAbaixoDaPresuncao) gatilhos.push('margem_abaixo_da_presuncao');
  if (['parte', 'maioria'].includes(r.mercadoriasComST)) gatilhos.push('opera_com_substituicao_tributaria');
  if (d.vendeParaOrgaoPublico) gatilhos.push('vende_para_orgao_publico');
  if (d.exporta) gatilhos.push('tem_receita_de_exportacao');
  if (d.passouDoSublimite) gatilhos.push('passou_do_sublimite_estadual');
  if (d.receitaMistaNoRegimeEspecifico) gatilhos.push('receita_mista_no_regime_especifico');
  if (r.aquisicoesUsoPessoal === 'relevante') gatilhos.push('credito_reduzido_por_uso_pessoal');
  const up = urgenciaEPrazo(saida, r, conf, hoje);
  const posicao = posicaoDeRegime(saida, conf, gatilhos, leitura);

  return {
    saida, gatilhos, posicao, modalidade: MODALIDADES[saida.modalidade],
    leituraPreliminar: leitura,
    derivadas: d, confianca: conf,
    urgencia: up.nivel,
    dataLimiteProtocolo: up.dataLimiteProtocolo,
    dentroDaAntecedencia: up.dentroDaAntecedencia,
    janelaAberta: up.janelaAberta, diasUteisAteFimDaJanela: up.uteisAteFim,
    diasCorridosAteFimDaJanela: up.corridosAteFim,
    antecedenciaOperacionalDias: PRAZO.folgaProtocoloDias,
    radar: radar(r),
    preliminar: conf.nivel === 'BAIXA',
  };
}
