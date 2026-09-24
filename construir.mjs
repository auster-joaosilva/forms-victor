/* Gera as páginas montadas a partir de fonte única.
 *
 *   modelo.html         + src/*.js  ->  portal.html   (formulário e relatório)
 *   modelo_adesao.html  + src/*.js  ->  adesao.html   (termo de opção)
 *
 * Fonte única: lê os módulos de src/ e os inlina no HTML, removendo
 * import/export. O mesmo código roda na varredura (Node) e no navegador — não
 * há duas versões para divergir. A página de adesão reaproveita validação e
 * consulta cadastral em vez de reescrevê-las: o CNPJ alfanumérico já está
 * tratado lá, e uma segunda implementação recusaria empresa válida.
 *
 * Uso: node construir.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';

const limpar = caminho => readFileSync(caminho, 'utf8')
  .replace(/^\s*import[\s\S]*?from\s+'[^']+';\s*$/gm, '')
  .replace(/^export\s+/gm, '')
  .replace(/^export\s*\{[^}]*\};?\s*$/gm, '');

/* Os dois logos entram aqui, e não no modelo: 63 KB de base64 no meio do HTML
 * tornavam o modelo ilegível e impossível de revisar por diff. A marca é ativo
 * versionado em ativos/, o modelo só diz onde cada variante entra.
 *
 * São DOIS arquivos, e não um com filtro: `invert(1)` sobre a logo negativa
 * leva #70CEEC a #8F3113 — marrom — na impressão. A variante positiva existe
 * para o papel. */
const LOGOS = {
  '/*__LOGO_TELA__*/': 'ativos/logo-contabil-negativa.b64',
  '/*__LOGO_PAPEL__*/': 'ativos/logo-contabil-positiva.b64',
};

function abortar(...linhas) {
  for (const l of linhas) console.error(l);
  process.exit(1);
}

function inlinarLogos(html, nome) {
  for (const [marcador, arquivo] of Object.entries(LOGOS)) {
    if (!html.includes(marcador)) {
      abortar(`ERRO: o marcador ${marcador} desapareceu de ${nome}.`,
              'Sem ele o cabeçalho sai com a imagem quebrada.');
    }
    html = html.replace(marcador, readFileSync(arquivo, 'utf8').trim());
  }
  return html;
}

/* Guarda contra um defeito que já aconteceu: atributo `onclick` roda no escopo
 * GLOBAL, e o script é `type="module"` — nenhuma const do módulo existe lá.
 * Escrever onclick="window.irPara(REVISAO)" lança ReferenceError e o botão fica
 * inerte, sem erro nenhum na tela. O valor tem de ser interpolado no template.
 *
 * Regra: dentro de um handler, IDENTIFICADOR_EM_MAIÚSCULAS é suspeito. Literais
 * de texto entre aspas passam; interpolações já foram resolvidas no build. */
export function conferirHandlersInline(texto) {
  const suspeitos = [];
  const handlers = /on(?:click|change|input|blur|submit)="([^"]*)"/g;
  for (const m of texto.matchAll(handlers)) {
    const corpo = m[1]
      .replace(/[$][{][^}]*[}]/g, '@')   // interpolacao: resolvida no navegador
      .replace(/'[^']*'/g, '@');         // literal de texto
    if (/[A-Z][A-Z0-9_]{2,}/.test(corpo)) suspeitos.push(m[1]);
  }
  return suspeitos;
}

/* Guarda contra o defeito irmão, que também já aconteceu: a função existe, está
 * exposta em `window` e NENHUM botão a chama. Foi o caso do relatório — pronto,
 * testado por chamada direta, e inalcançável pela tela por três horas. Teste de
 * unidade não pega: ele chama a função. Só a fiação prova a fiação. */
export function conferirFuncoesOrfas(texto) {
  const orfas = [];
  for (const m of texto.matchAll(/window\.([a-zA-Z_$][\w$]*)\s*=\s*(?:\(|function|async)/g)) {
    const nome = m[1];
    // O handler pode chamar com ou sem o prefixo `window.`: as duas formas
    // funcionam, porque o atributo roda no escopo global. Exigir o prefixo
    // acusava como órfã toda função do backoffice — falso positivo.
    const chamada = new RegExp(
      `on(?:click|change|input|blur|submit)="[^"]*(?:window\\.)?${nome}\\(`);
    if (!chamada.test(texto)) orfas.push(nome);
  }
  return orfas;
}

function guardar(html, nome) {
  for (const [rotulo, achados, conserto] of [
    ['função exposta em window e não chamada por handler nenhum',
     conferirFuncoesOrfas(html),
     'Ou ligue ao botão que deveria chamá-la, ou apague — as duas coisas são '
     + 'melhores que uma tela que não alcança a função.'],
    ['handler inline cita identificador de módulo e vai lançar ReferenceError',
     conferirHandlersInline(html),
     'Interpole o valor no template em vez de escrever o nome.'],
  ]) {
    if (achados.length) {
      abortar(`ERRO em ${nome}: ${rotulo}.`, ...achados.map(x => `  ${x}`), conserto);
    }
  }
}

function exigirMarcador(html, marcador, nome, porque) {
  if (!html.includes(marcador)) abortar(`ERRO: o marcador ${marcador} desapareceu de ${nome}.`, porque);
}

// ------------------------------------------------------------------ portal
const modulosDoPortal = ['src/validacao.js', 'src/consulta_cnpj.js', 'src/simples.js',
                         'src/perguntas.js', 'src/motor.js', 'src/acoes.js']
  .map(limpar).join('\n\n');

let portal = readFileSync('modelo.html', 'utf8').replace('/*__MODULOS__*/', modulosDoPortal);
portal = inlinarLogos(portal, 'modelo.html');
exigirMarcador(portal, '/*__PUBLICACAO__*/', 'modelo.html',
  'É por ele que o servidor injeta endpoint e convite. Sem ele, o portal servido '
  + 'nunca envia resposta nenhuma — em silêncio.');
guardar(portal, 'portal.html');
writeFileSync('portal.html', portal, 'utf8');

// ------------------------------------------------------------------ adesão
const modulosDaAdesao = ['src/validacao.js', 'src/consulta_cnpj.js']
  .map(limpar).join('\n\n');

let adesao = readFileSync('modelo_adesao.html', 'utf8')
  .replace('/*__MODULOS__*/', modulosDaAdesao);
adesao = inlinarLogos(adesao, 'modelo_adesao.html');
exigirMarcador(adesao, '/*__PUBLICACAO__*/', 'modelo_adesao.html',
  'É por ele que o servidor injeta o texto do termo. Sem ele a página abre vazia.');
guardar(adesao, 'adesao.html');
writeFileSync('adesao.html', adesao, 'utf8');

// -------------------------------------------------------------- backoffice
/* O backoffice não é montado pelo build — é servido como está. Mas as duas
 * guardas valem para ele igual: é HTML com handler inline e funções em
 * `window`, os mesmos dois defeitos. */
guardar(readFileSync('backoffice.html', 'utf8'), 'backoffice.html');

console.log(`portal.html gerado — ${(portal.length / 1024).toFixed(0)} KB`);
console.log(`adesao.html gerado — ${(adesao.length / 1024).toFixed(0)} KB`);
