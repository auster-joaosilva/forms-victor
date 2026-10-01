# Etapa 2 — Adesão, prazos da CGSN 194 e os quatro papéis

Data: 2026-10-01 · Status: aprovado em conversa

Base: a Etapa 1 (`2026-09-30-diagnosis-design.md`), no ar em `hml-reforma.austercontabil.com.br` pela branch `teste`.

**O portal antigo de referência é a `origin/main` de hoje, não o retrato `22b3cfc:legacy/`.** Entre 30/09 e 01/10 o Victor fez três commits na `main`:
- `212aea5`: prazos da Resolução CGSN 194/2026, termo V5 com a V4 congelada e reimpressão pela versão aceita.
- `44434e7`: o merge do anterior e a capa na raiz.
- `10f5a4c`: os quatro papéis e a portaria única.

Leitura: `git show origin/main:<arquivo>` (`src/termo.js`, `src/motor.js`, `src/acoes.js`, `src/papeis.mjs`, `servidor.mjs`, `modelo_adesao.html`, `backoffice.html`, `src/banco.mjs`).

## Decisões

| # | Decisão |
|---|---|
| A1 | **Tudo numa etapa.** A Etapa 2 traz os prazos da CGSN 194 para o motor e as telas do diagnóstico, os quatro papéis para o backoffice que já existe, e a adesão completa: tela, recibo, documento, backoffice e migração. |
| A2 | **A virada é antes de 30/10/2026.** O formulário público do app novo vai receber adesões reais, que valem como prova. |
| A3 | **Conteúdo fiel à `main`.** Termo, faixas de prazo, mensagens de tela e de servidor, rótulos e colunas do CSV ficam como na `main`, inclusive a validação mais frouxa do servidor (telefone opcional, sem dígito verificador). As sobras de "20/11" no V5 também ficam (seção 9). |
| A4 | **Duas correções de comportamento.** (a) O recibo sobrevive ao F5, por cookie com um token aleatório. (b) O vínculo com o diagnóstico usa a resposta mais recente com o mesmo `cnpjDigits`, no lugar do `LIKE` do antigo. |
| A5 | **O termo é prova.** `TERM_V4` não muda. `TERM_V5` entra palavra por palavra e na mesma ordem de chaves da `main`. Hashes: V4 `94667b1747b65c3e177416ee98e63a79b10599c1a5240b3a0836c094c0788441`, V5 `27bfd24bb5f55bf12b0dd3935769cb51bf434f6a63c515aed1e5254399f8f004`. A via sai sempre com o texto da versão aceita. |
| A6 | **Capacidade por função.** A tabela de `papeis.mjs` vira `server/identity/domain/permissions.ts`. O backoffice só obtém a sessão por `requireCapability(cap)`. Um teste de cobertura falha se uma server function ou rota CSV do backoffice não declarar a capacidade. |
| A7 | **Aba Adesões: porte fiel + quem tratou.** É a aba antiga, mais "tratado por fulano em data" na lista e o CSV com a proteção contra fórmula do CSV de respostas. Sem ficha e sem nota. |
| A8 | **Protocolo `ADS-AAAAMMDD-XXXXX` com a data de Brasília**, como o `DS-` da Etapa 1. O antigo usava UTC. |
| A9 | **Sem rate limit e sem trava de duplicata no envio**, como no antigo, que deixou `/api/adesao` fora de propósito. Cada confirmação é uma adesão nova, com protocolo novo. |

## 1. Prazos da CGSN 194 (sincronização com a `main`)

- O calendário sai de `diagnosis/domain/thresholds.ts` para `server/shared/domain/deadlines.ts`. A adesão precisa dele, e um `domain` não importa outro.
  ```ts
  export const DEADLINES = {
    windowEnd: '2026-10-30',          // opção pelo regime regular, Res. CGSN 194/2026
    simplesEntryUntil: '2026-10-15',  // ingresso no Simples para 2027
    withdrawalFrom: '2026-11-03',     // antes disso o cancelamento não existe
    withdrawalUntil: '2026-12-20',
    effectSemester, nextWindow, nextWindowEffect, filingSlackDays, // como hoje
  }
  ```
- Textos: entram os de `212aea5` em `src/motor.js` (comentário do fundamento, `POSICOES`, `SAIDAS` C, E e E_SEM_DADO), `src/acoes.js` (`decidir_com_os_socios`, `fechar_a_conta_ate_o_inicio_de_novembro`, `ciencia_da_trava_do_ressarcimento`, `simular_as_duas_opcoes`, `regularizar_debitos_no_prazo`) e `modelo.html` (resultado, "Três coisas para não errar", relatório). O plano lista cada troca, pelo diff `git diff 1c4e980 212aea5 -- src/motor.js src/acoes.js modelo.html`.
- As respostas já gravadas mantêm as projeções antigas, porque são o que o cliente viu.
- Os testes de `testes.mjs` que a `212aea5` mexeu são portados.

## 2. Papéis e permissões

`server/identity/domain/permissions.ts`, puro:

| Papel (`role`) | Rótulo | Capacidades |
|---|---|---|
| `admin` | administrador | todas |
| `manager` | gestor de departamento | todas menos `manage_users` |
| `regularization` | regularização | comuns + `view_responses`, `handle_responses`, `view_adhesions`, `handle_adhesions`, `reprint_term` |
| `operator` | operador | comuns + `view_responses`, `handle_responses`, `view_invitations`, `manage_invitations`, `view_events`, `manage_events`, `handle_registrations` |

- **Capacidades comuns:** `dashboard`, `own_access`.
- **Lista completa:** `dashboard`, `own_access`, `view_responses`, `handle_responses`, `export_responses`, `view_adhesions`, `handle_adhesions`, `export_adhesions`, `reprint_term`, `view_invitations`, `manage_invitations`, `view_events`, `manage_events`, `handle_registrations`, `export_registrations`, `view_audit`, `manage_users`. As de eventos ficam declaradas para a Etapa 3.
- Papel desconhecido vale `operator`, o mais fechado (`PAPEL_PADRAO` do antigo).
- `can(role, capability)`, `capabilitiesOf(role)`, `ROLE_LABELS`.

Servidor:
- **`requireCapability(cap)`** em `server/shared/http/session-middleware.ts`. Confere a sessão e a capacidade e põe `context.session.user` no contexto. Sem sessão, devolve `unauthenticated`. Sem a capacidade, devolve `forbidden` ("o seu papel não alcança esta área") e audita `access_denied` com referência = a capacidade exigida e detalhe `{role, required}` (um middleware de server function não conhece o nome da função; as rotas CSV acrescentam `path`).
- O `sessionMiddleware` e o `adminMiddleware` deixam de ser exportados para as features.
- **`ensureCapability(request, cap)`**: o mesmo para os handlers de rota (CSV), que não passam por middleware de função.
- **Quem exige o quê:**

  | Área | Capacidade |
  |---|---|
  | Respostas: lista e ficha | `view_responses` |
  | Respostas: tratar | `handle_responses` |
  | Respostas: CSV | `export_responses` |
  | Relatório pelo backoffice | `view_responses` |
  | Adesões: lista | `view_adhesions` |
  | Adesões: tratar | `handle_adhesions` |
  | Adesões: CSV | `export_adhesions` |
  | Via do termo | `reprint_term` |
  | Convites: lista | `view_invitations` |
  | Convites: criar e apagar | `manage_invitations` |
  | Auditoria | `view_audit` |
  | Usuários: lista e criação | `manage_users` |
  | Troca da própria senha | `own_access` |

  A troca de senha decide por dentro, como hoje: quem não administra só alcança a própria senha.
- **Teste de cobertura:** lê os fontes de `src/features/backoffice-*/api/*.ts` e de `src/app/routes/backoffice/**`. Falha quando uma chamada `createServerFn(...)` não encadeia `.middleware([requireCapability(...)])`, ou quando um `server.handlers` não chama `ensureCapability`. A mensagem aponta o arquivo e o nome da função.
- O `getCurrentUser` devolve `capabilities`. As abas (`TAB_KEYS`) e os botões de CSV aparecem por capacidade, não por `adminOnly`.
- **better-auth:** `admin({ defaultRole: 'operator', adminRoles: ['admin'] })`.
- **`identity`:** o `Role` passa a ter os quatro valores. A regra do último administrador continua. Só `admin` cria usuário ou muda papel. A aba Usuários oferece os quatro papéis, com os rótulos.
- **Migração do Prisma:** `UPDATE users SET role = 'operator' WHERE role = 'team'`, o padrão da coluna vira `'operator'`, e o enum `UserRole` passa a `admin | manager | regularization | operator`. `team` não sobe para `manager`, por decisão do Victor: rebaixar por engano se conserta em dois cliques, manter alcance por engano não aparece em lugar nenhum.
- **`AUDIT_ACTIONS`** ganha `access_denied`, com o rótulo "acesso negado".

## 3. Rotas

| Rota | O que é |
|---|---|
| `/adhesion` | Formulário, janela encerrada e recibo. `?invite=TOKEN` pré-preenche (o 301 de `/adesao?c=` já existe). |
| `/backoffice` | Ganha a aba Adesões, entre Respostas e Convites. |
| `/backoffice/adhesions/$id/term` | A via do termo pela versão aceita (o 301 de `/backoffice/termo?id=` já existe). |
| `/backoffice/adhesions.csv` | Planilha das adesões, com o filtro da tela. |

## 4. Servidor — módulo `adhesion`

**`domain/`**, tudo puro:
- `term.ts`: `TERM_V4` (intocado), `TERM_V5`, `TERMS = { V4: TERM_V4, V5: TERM_V5 }`, `CURRENT_TERM = TERM_V5`, `termFor(version) → Term | null`, `computeTermHash(term)`. O tipo `Term` passa a ser a união dos dois.
- `window.ts`: `adhesionWindow(now) → { state: 'open' | 'closed', end: '2026-10-30' }`, pelo dia de Brasília (`brasiliaDateParts`). O último dia conta inteiro.
- `protocol.ts`: `ADHESION_PROTOCOL_PATTERN = /^ADS-\d{8}-[A-Z0-9]{5}$/`, `formatAdhesionProtocol(now, suffix)`, alfabeto `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`.
- `submission.ts`: `checkSubmission(body, { windowState, windowEnd, currentVersion })` devolve os dados normalizados ou a primeira recusa. Segue a ordem e as mensagens de `conferirAdesao` da `main`:
  1. `corpo inválido`
  2. `a janela de opção encerrou em DD/MM/AAAA; fale com a equipe da Auster`
  3. `sem a declaração final marcada`
  4. `modalidade inválida`
  5. `falta escolher o que acontece sem manifestação até 10/12`
  6. `o termo foi atualizado; recarregue a página e confirme de novo`
  7. `falta {razão social | CNPJ | nome do representante | CPF | cargo | e-mail}`
  8. `CNPJ incompleto`
  9. `CPF incompleto`

  Os campos são aparados, o telefone vira `''` e `semManifestacao` só existe no híbrido.
- `client-rules.ts`: as regras da tela (`cnpjValido` alfanumérico, CPF com dígitos, `emailValido`, `telefoneValido`, `nomeValido ≥ 3`, cargo da lista), com as mensagens exatas e as máscaras de CNPJ e CPF. São usadas só pela tela, que é como o antigo funciona.
- `labels.ts`: os rótulos da `main`.
  - Situação: Recebida, Protocolada, Cancelada.
  - Modalidade curta: Simples Padrão, Simples Híbrido.
  - Modalidade longa: "Simples Nacional Puro (Padrão)", "Simples Nacional Híbrido (CBS fora do DAS)".
  - Sem manifestação: "cancela em 20/11", "mantém em 20/11", "autoriza cancelar, voltando ao Padrão", "mantém o Híbrido".
- `csv.ts`: as 24 colunas de `planilhaDeAdesoes`, na ordem e com os cabeçalhos da `main`. `aceito em` sai em ISO UTC, como no antigo. Usa o `toCsv` da Etapa 1 (BOM, `;`, CRLF, proteção contra fórmula), que passa para `shared/domain`. Nome do arquivo: `adesoes-simples-AAAA-MM-DD.csv`, com a data de Brasília.
- `term-copy.ts`: monta o que a via mostra a partir da adesão gravada e de `termFor(termVersion)`.

**`ports/`**: `AdhesionRepository` (criar; `findByReceiptToken`; `protocolExists`; e, para o backoffice, `list`, `counts`, `findById`, `listForExport`, `setStatus`), `ResponseLookup.latestByCnpjDigits(digits) → id | null`, `InvitationGateway` (`find`, `countOpen`), `ProtocolGenerator`, `Clock`, `AdhesionAuditRecorder`, `ReceiptTokenGenerator`.

**`application/`**:
- **`submitAdhesion({ body, origin, userAgent })`.** Passos:
  1. roda `checkSubmission` com a janela do `Clock` e `CURRENT_TERM.versao`;
  2. busca o convite e só o liga se o token existir; senão, nulo;
  3. pega o `responseId` em `latestByCnpjDigits`;
  4. calcula o hash de `CURRENT_TERM` no servidor, uma vez por processo;
  5. grava `acceptedAt` com o relógio do servidor;
  6. grava a origem: `originIp`, `originSource` e `forwardedChain` vêm de `requestOrigin`, e o `userAgent` é cortado em 300 caracteres;
  7. grava o `payload` com o objeto normalizado inteiro, como o `pacote`, incluindo `comoObtido` e `cadeia`;
  8. gera o protocolo, com até 10 tentativas;
  9. gera o `receiptToken`, de 32 bytes em hex;
  10. audita `adhesion_received` com `{ id, modality }`.

  Tudo o que o navegador mandar como hash, origem, data ou versão gravada é ignorado. Devolve o recibo e o token.
- **`adhesionReceipt(token)`** devolve o recibo e os dados da via, ou `null`.
- **`openAdhesionPage(inviteToken | null)`.** Conta a abertura (`openCount + 1`, `lastOpenedAt`) a cada carga, como `marcarAbertura`. Devolve o pré-preenchimento `{ companyName, cnpj, email }`, só com as chaves presentes, e o token, se o convite existir.
- **`adhesionBackoffice`:**
  - `list({ status?, modality?, search?, page? })`: contadores `{ total, standard, hybrid, received, filed, cancelled, toFile }`, onde `toFile` conta os híbridos recebidos; a busca procura em empresa, CNPJ, protocolo e representante; ordem `acceptedAt` decrescente; 50 por página;
  - `handle(actor, { id, status })`: recusa `filed` em adesão padrão ("só a opção pelo híbrido é protocolada"), grava `handledById` e `handledAt` e audita `adhesion_handled` com `{ from, to }`;
  - `export(actor, filter)`: até 5.000 linhas; audita `spreadsheet_exported` com `{ kind: 'adhesions', count, ... }`;
  - `termCopy(id)`: devolve a via, ou `unknown_version` com a mensagem "Esta adesão foi aceita na versão {v} do termo, cujo texto não está mais no sistema. A via não pode ser tirada sem ele.", ou `not_found` com "Adesão não encontrada.".

**Cookie** `adhesion_receipt` em `server/shared/http`: guarda o `receiptToken`, nunca o id. É `httpOnly`, `SameSite=Lax`, `Secure` em produção e dura 7 dias. "Nova confirmação" apaga o cookie.

**Schema** (migração nova): `Adhesion.receiptToken String? @unique @map("receipt_token")`. Fica nulo nas adesões migradas.

## 5. Telas públicas — `src/features/adhesion`

- **`api/`:**
  - `loadAdhesionPage({ invite })` devolve `{ window, prefill, invitationToken, receipt }`; o `receipt` vem do cookie;
  - `lookupAdhesionCompany({ cnpj })` devolve só `{ companyName }`, pelo `company-lookup`, sem rate limit, como o `lookupCnpj` da Etapa 1;
  - `submitAdhesion(body)` grava o cookie e devolve o recibo;
  - `startNewAdhesion()` apaga o cookie.
- **Janela encerrada:** o cartão "A janela de opção encerrou", com os textos da `main` e o `mailto:contato@austercontabil.com.br`. Não há formulário.
- **Formulário**, numa página só e na ordem de `desenhar()` da `main`:
  1. faixa "**Prazo.** … até 30/10/2026 … até 29/10/2026";
  2. "Identificação da empresa": CNPJ (máscara e consulta ao sair do campo), razão social, representante, cargo (lista fechada), CPF (máscara), e-mail e telefone;
  3. "O que você está confirmando": orientação, prazos, critérios e ciência;
  4. "Modalidade escolhida": dois cartões; o híbrido abre a sub-escolha com o enunciado do termo, e trocar de modalidade limpa a sub-escolha;
  5. "Serviços complementares", com o "quer proposta";
  6. "Declaração final": caixa, declaração, botão "Confirmar a opção" / "Registrando…" e a nota abaixo.

  Validação ao clicar, com as mensagens de `client-rules`. "Faltam campos acima." rola até o primeiro erro. Erro de rede ou do servidor mostra "Não consegui registrar: {erro}. Tente de novo.". Os campos e o botão só respondem depois da hidratação.
- **Consulta do CNPJ:** "consultando…" e, em caso de falha, "não consegui consultar o cadastro agora — confira a razão social à mão.". Preenche a razão social só se ela estiver vazia. Nunca bloqueia o envio.
- **Recibo:**
  - "Opção registrada", o protocolo, "Modalidade:" e "Registrado em:", com data e hora de Brasília formatadas no servidor;
  - a linha do híbrido ("A Auster fará a opção no Portal do Simples Nacional até 30/10/2026 e confirmará por e-mail.") ou a do padrão ("Nada a protocolar: a empresa permanece com a CBS dentro do DAS.");
  - "Guarde a sua via" e "Baixar o termo (PDF)";
  - "Nova confirmação", que apaga o cookie e volta ao formulário vazio;
  - "Voltar ao diagnóstico", que leva a `/diagnosis`. No antigo era `/`, que aqui ainda é provisória até a capa da Etapa 3.
- **`components/term-document.tsx`.** `TermDocument({ term, adhesion })` é o `montarDocumento` da `main`:
  - título e subtítulo;
  - seções 1 a 6 e a declaração final;
  - o bloco "Registro do aceite eletrônico", com representante, CPF, cargo, data e hora de Brasília e ISO, protocolo, origem ("não registrada" se faltar), versão e o SHA-256;
  - o rodapé.

  Usa o CSS de impressão do antigo (`@page{margin:8mm}`, `.folha{padding:0 14mm}`, `break-inside: avoid`, logo positivo). O `printWhenReady('Termo-Opcao-SN-<NOME>')` dá o nome do PDF: NOME em maiúsculas, sem acento, `[^A-Z0-9]+` vira `-`, até 60 caracteres, `EMPRESA` se vazio.
- Nada em `localStorage`/`sessionStorage`. O estado do formulário vive no React; a única coisa no navegador é o cookie `httpOnly`.

## 6. Backoffice — `src/features/backoffice-adhesions`

- **Aba "Adesões"**, só com `view_adhesions`. Traz o que a aba da `main` tem:
  - **Contadores:** Total, Híbrido, Padrão, A protocolar e Protocoladas.
  - **Aviso com `toFile > 0`:** "N empresa(s) autorizou/autorizaram…". Com a janela aberta, completa com "O prazo é 30/10/2026."; com ela encerrada, com "O prazo terminou em 30/10/2026. Estas não podem mais ser protocoladas: …". A data vem de `DEADLINES`.
  - **Filtros:** busca ("Empresa, CNPJ, protocolo ou representante"), "Todas as modalidades" e "Todas as situações".
  - **Lista**, com as colunas Empresa, Quem confirmou, Modalidade, Confirmado e Situação. A Situação traz o selo "quer proposta" e **"tratado por {usuário} em {data}"**.
  - **Ações:**
    - "Termo (PDF)": abre a via em nova aba;
    - "Protocolei": só em híbrido recebido;
    - "Cancelar": em quem não está cancelada, com a confirmação "Cancelar esta adesão? Use quando o cliente desistiu ou o termo saiu errado.".
  - **Botão "Baixar planilha (CSV)":** só com `export_adhesions`.
  - **Estado vazio e rodapé** com os textos da `main`.
  - **Erro de ação:** "Não consegui mudar a situação: {motivo}. Tente de novo.".
- **`/backoffice/adhesions/$id/term`** (`reprint_term`): compõe o `TermDocument` de `features/adhesion`, como o relatório da Etapa 1 compõe o de `features/diagnosis`. Versão desconhecida mostra a mensagem do 409; id inexistente dá `notFound()`.
- **`/backoffice/adhesions.csv`** (`export_adhesions`): o `Content-Disposition` e o `no-store` do CSV de respostas.
- **Convites:** o botão "Adesão" já existe. O bloqueio de apagar já conta as adesões.

## 7. Migração do SQLite antigo

`legacy-import` passa a importar, nesta ordem: usuários → convites → respostas → **adesões** → auditoria.

- **Usuários:** `admin` vira `admin`; `gestor`, `manager`; `regularizacao`, `regularization`; `operador` e `equipe`, `operator`. Papel desconhecido vira `operator`, com aviso.
- **Adesões:**
  - **Ids e protocolos:**
    - os ids antigos são preservados;
    - mesmo id com mesmo protocolo é pulado; mesmo id com outro protocolo é conflito; protocolo que pertence a outro id também é conflito;
    - protocolo repetido no SQLite ganha `-2`, `-3`, como em E6 da Etapa 1;
    - no fim, a sequência de `adhesions` é reiniciada com `setval`.
  - **Tradução de valores:**
    - situação: `recebida`, `protocolada` e `cancelada` viram `received`, `filed` e `cancelled`;
    - modalidade: `padrao` e `hibrido` viram `standard` e `hybrid`;
    - sem manifestação: `cancelar` e `manter` viram `cancel` e `keep`;
    - `quer_proposta = 1` vira `true`.
  - **Prova:**
    - `termVersion` e `termHash` vêm de `versao_termo` e `resumo_termo` **como gravados**, nunca recalculados;
    - `pacote` vai inteiro para `payload`;
    - `originIp` vem de `origem`; `originSource` e `forwardedChain`, de `pacote.comoObtido` e `pacote.cadeia`; `userAgent`, de `agente`;
    - `acceptedAt` vem de `aceito_em`;
    - `cnpjDigits` é calculado, e CNPJ e CPF ficam como digitados;
    - `receiptToken` fica nulo.
  - **Vínculos:**
    - `resposta_id` inexistente vira nulo, com aviso;
    - token de convite inexistente vira nulo, com aviso;
    - `tratado_por` é ligado pelo nome; nome inexistente fica sem autor, com aviso.
  - **Obrigatório no Prisma e nulo no SQLite** (`nome_empresa`, `cnpj`, `representante`, `cpf`, `cargo`, `email`): entra `''`, com aviso.
  - **`versao_termo` fora de `TERMS`:** aviso; a via vai responder 409.
- **Auditoria:** `acesso_negado` vira `access_denied`. `adesao_recebida`, `adesao_tratada` e `planilha_adesoes_exportada` já estão mapeadas.
- **Simulação:** o `--dry-run` e o relatório contam `adhesions: { found, imported, skipped }`.
- **Passo a passo:** o do `AGENTS.md` fica como está. O ensaio em hml passa a apagar também `DELETE FROM adhesions;`, antes das respostas.

## 8. Testes

- **`domain`:**
  - hashes V4 e V5 fixados, e `TERMS` com exatamente V4 e V5;
  - janela aberta em 30/10 às 23:59:59 de Brasília e fechada em 31/10 às 00:00;
  - protocolo no formato, com a data de Brasília perto da meia-noite UTC;
  - cada recusa de `checkSubmission`, com a mensagem exata e na ordem;
  - `client-rules`: CNPJ alfanumérico, CPF, telefone e máscaras;
  - CSV: 24 colunas, cabeçalhos, escape e fórmula;
  - `permissions` igual à tabela de `papeis.mjs`, papel desconhecido virando `operator`;
  - invariantes do motor sobre os 40 mil preenchimentos, com a nova: nenhum texto gerado cita "30 de setembro", "até 30 de novembro" ou "30/09/2026";
  - os testes de `testes.mjs` da `212aea5`.
- **`application`, com fakes:**
  - hash, origem e data do navegador ignorados;
  - janela encerrada e versão velha recusadas;
  - `responseId` só por `cnpjDigits` exato;
  - convite inexistente vira nulo;
  - protocolo repetido gera de novo;
  - `filed` em adesão padrão recusado;
  - `termCopy` pela versão, versão desconhecida, id inexistente;
  - `requireCapability` audita `access_denied`;
  - só o admin muda papel.
- **`adapters` (`*.int.test.ts`):**
  - repositório de adesões: criação, `findByReceiptToken`, filtros, contadores, `setStatus`;
  - migração do Prisma de `team` para `operator`;
  - migração do SQLite com adesões de exemplo (protocolo repetido, resposta órfã, convite órfão, versão desconhecida, nulos, os quatro papéis e `equipe`), rodada duas vezes.
- **Cobertura de capacidade:** o teste da seção 2.
- **Componentes:**
  - a sub-escolha do híbrido aparece, e é limpa ao trocar;
  - as máscaras ao sair do campo;
  - o cartão de janela encerrada;
  - o recibo com "Nova confirmação";
  - a aba Adesões: "Protocolei" só em híbrido recebido e o CSV escondido sem `export_adhesions`.
- **Ponta a ponta:**
  - convite → `/adhesion?invite=` pré-preenche → confirmar híbrido → recibo → F5 mantém o recibo → título do PDF `Termo-Opcao-SN-…`;
  - "Nova confirmação" volta ao formulário vazio;
  - usuário `regularization` vê a adesão, marca "Protocolei" e abre a via;
  - usuário `operator` não vê a aba, e a server function da lista responde `forbidden`;
  - o diagnóstico mostra "30 de outubro";
  - nada em `localStorage`/`sessionStorage`.

  O global setup do e2e cria também os usuários `e2e-regularization` e `e2e-operator`.

## Critério de pronto (em hml, pela branch `teste`)

1. O diagnóstico mostra os prazos da CGSN 194 na tela e no relatório.
2. Uma adesão V5 feita no navegador grava o hash, a origem, a data e o protocolo calculados pelo servidor.
3. O recibo sobrevive ao F5, e o PDF sai com o nome certo, pelo cliente e pelo backoffice.
4. A via de uma adesão V4 migrada sai com o texto da V4.
5. Os quatro papéis valem nas server functions e nas rotas CSV, não só na tela. A recusa aparece na Auditoria.
6. A migração roda em `--dry-run` e de verdade com as adesões, duas vezes, sem duplicar.
7. `pnpm lint && pnpm typecheck && pnpm test` limpos e o ponta a ponta passando.

## 9. Pendências registradas, fora desta etapa

- **`[CONFIRMAR COM VICTOR]`:** a data de corte da manifestação no V5 (10/12/2026) é compromisso operacional, não prazo legal. Entra como está na `main`.
- **Sobras de "20/11" no V5** (o Victor decide o conteúdo):
  - o erro da tela "escolha o que acontece se não houver manifestação até 20/11";
  - os rótulos "cancela/mantém em 20/11";
  - o cabeçalho do CSV "sem manifestacao ate 20/11".

  Na `main` o servidor já diz 10/12. Ficam fiéis à `main` até ele decidir.
- **Etapa 3 antes da virada.** Com a virada antes de 30/10, ou eventos, inscrições e capa entram antes, ou a virada leva o app novo sem essas páginas, com um destino a definir.
- **Acompanhar a `main`.** Antes da virada, conferir `git log teste..origin/main` e trazer o que mudou.

## Fora do escopo

- Mudança de conteúdo jurídico ou de texto.
- Eventos, inscrições e capa (Etapa 3).
- Pedido de cancelamento pelo cliente na janela de 03/11 a 20/12. O antigo também não tem.
- E-mail automático. O "confirmará por e-mail" continua manual.
- Virada de domínio.
