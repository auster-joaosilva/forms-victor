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

/* O favicon é um só para todas as páginas, e mora em `ativos/favicon.svg`.
 * Antes cada página trazia o seu, escrito à mão, e eram dois desenhos
 * diferentes — nenhum a marca. */
function faviconEmUri() {
  const svg = readFileSync('ativos/favicon.svg', 'utf8').trim().replace(/"/g, "'");
  return 'data:image/svg+xml,' + encodeURIComponent(svg)
    .replace(/%2F/g, '/').replace(/%3A/g, ':').replace(/%3D/g, '=')
    .replace(/%3C/g, '<').replace(/%3E/g, '>').replace(/%27/g, "'").replace(/%20/g, ' ');
}

/* A folha de estilo das páginas públicas é UMA. A de eventos e a principal
 * partilham capa, botões, cartões e rodapé; se cada uma trouxesse a sua
 * cópia, em três meses a marca teria dois azuis e dois raios de canto. */
function estiloPublico() {
  return readFileSync('ativos/estilo_publico.css', 'utf8').trim();
}

function abortar(...linhas) {
  for (const l of linhas) console.error(l);
  process.exit(1);
}

/* `quais` diz quais variantes a página declara. Páginas que também vão ao
 * papel (portal, termo) pedem as duas; a de eventos é só de tela e pede uma.
 * Exigir as duas de todas transformaria "não imprime" em erro de build. */
function inlinarLogos(html, nome, quais = Object.keys(LOGOS)) {
  for (const marcador of quais) {
    if (!html.includes(marcador)) {
      abortar(`ERRO: o marcador ${marcador} desapareceu de ${nome}.`,
              'Sem ele o cabeçalho sai com a imagem quebrada.');
    }
    /* `replaceAll`, e não `replace`: a mesma marca aparece mais de uma vez na
     * página (a barra do topo e a capa usam o logo). Com `replace` só a
     * primeira era trocada e a segunda seguia no HTML como texto cru, dentro
     * de um `src` — imagem quebrada, e sem erro de build. */
    html = html.replaceAll(marcador, readFileSync(LOGOS[marcador], 'utf8').trim());
  }
  const sobrando = Object.keys(LOGOS).filter(m => !quais.includes(m) && html.includes(m));
  if (sobrando.length) {
    abortar(`ERRO: ${nome} tem ${sobrando.join(' e ')} e o build não foi mandado preenchê-lo.`,
            'Ou acrescente o marcador à lista, ou tire-o da página.');
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

// ------------------------------------------------------------------ eventos
/* A página de eventos serve dois desenhos — a lista e o evento — porque os
 * dois compartilham capa, rodapé e folha de estilo; o servidor injeta um ou
 * outro. Um arquivo a menos para divergir. */
let evento = readFileSync('modelo_evento.html', 'utf8');
exigirMarcador(evento, '/*__ESTILO__*/', 'modelo_evento.html',
  'É por ele que entra a folha de estilo das páginas públicas. Sem ele a página '
  + 'abre sem desenho nenhum.');
evento = evento
  .replace('/*__MODULOS__*/', modulosDaAdesao)
  .replace('/*__ESTILO__*/', estiloPublico())
  .replace('/*__FAVICON__*/', faviconEmUri());
evento = inlinarLogos(evento, 'modelo_evento.html', ['/*__LOGO_TELA__*/']);
exigirMarcador(evento, '/*__PUBLICACAO__*/', 'modelo_evento.html',
  'É por ele que o servidor injeta o evento ou a lista. Sem ele a página abre vazia.');
guardar(evento, 'evento.html');
writeFileSync('evento.html', evento, 'utf8');

// ------------------------------------------------------------- principal
/* A capa institucional: as portas do portal num lugar só. Não tem módulo de
 * src/ — não valida CNPJ nem consulta cadastro, só encaminha. */
let principal = readFileSync('modelo_principal.html', 'utf8');
exigirMarcador(principal, '/*__ESTILO__*/', 'modelo_principal.html',
  'É por ele que entra a folha de estilo das páginas públicas.');
principal = principal
  .replace('/*__ESTILO__*/', estiloPublico())
  .replace('/*__FAVICON__*/', faviconEmUri());
principal = inlinarLogos(principal, 'modelo_principal.html', ['/*__LOGO_TELA__*/']);
exigirMarcador(principal, '/*__PUBLICACAO__*/', 'modelo_principal.html',
  'É por ele que o servidor diz se há evento aberto e se a janela de opção segue '
  + 'de pé. Sem ele a página promete encontro que não existe.');
guardar(principal, 'principal.html');
writeFileSync('principal.html', principal, 'utf8');

// -------------------------------------------------------------- backoffice
/* O backoffice não é montado pelo build — é servido como está. Mas as duas
 * guardas valem para ele igual: é HTML com handler inline e funções em
 * `window`, os mesmos dois defeitos. */
guardar(readFileSync('backoffice.html', 'utf8'), 'backoffice.html');

console.log(`portal.html gerado — ${(portal.length / 1024).toFixed(0)} KB`);
console.log(`adesao.html gerado — ${(adesao.length / 1024).toFixed(0)} KB`);
console.log(`evento.html gerado — ${(evento.length / 1024).toFixed(0)} KB`);
console.log(`principal.html gerado — ${(principal.length / 1024).toFixed(0)} KB`);
