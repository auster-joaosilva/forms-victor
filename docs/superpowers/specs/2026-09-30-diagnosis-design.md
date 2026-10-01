# Etapa 1 — Diagnóstico, backoffice de respostas e convites, migração

Data: 2026-09-30 · Status: aprovado em conversa, aguardando revisão da spec escrita

Base: a fundação (`2026-09-30-foundation-design.md`), já no ar em `hml-reforma.austercontabil.com.br` pela branch `teste`. O portal antigo está no histórico (`git show 22b3cfc:legacy/...`).

## Decisões

| # | Decisão |
|---|---|
| E1 | **Porte fiel do conteúdo.** Perguntas, textos, prazos, URL da Avaliação Prévia, retenção de 24 meses e recomendação ficam como no antigo. Depois de 30/09/2026 as telas mostram "janela encerrada", como o motor já calcula. Mudança de conteúdo é etapa própria, decidida pelo Victor. |
| E2 | **Um rascunho, uma resposta, vale a última versão.** O envio continua automático ao chegar ao resultado. O primeiro envio cria a `Response` e o protocolo; os seguintes atualizam a mesma resposta, com o mesmo protocolo e o diagnóstico recalculado. |
| E3 | **PDF pela impressão do navegador**, como hoje (`window.print()`, título `Plano-De-Acao-SN-<EMPRESA>`). Sem biblioteca de PDF. |
| E4 | **Estado no navegador, salvo no servidor.** As respostas vivem em estado React; visibilidade, validação e resultado provisório usam o `server/diagnosis/domain`. A cada mudança, com espera de 600 ms, o rascunho é gravado no banco. O envio recalcula tudo no servidor e ignora o diagnóstico do navegador. |
| E5 | **Backoffice de respostas, convites, usuários e auditoria entra nesta etapa**, assim como a migração das respostas, convites, usuários e auditoria do SQLite antigo. Adesões ficam para a Etapa 2 e inscrições para a Etapa 3. |
| E6 | Protocolo duplicado no banco antigo vira `-2`, `-3` na migração. Nada se perde. |

## 1. Rotas

| Rota | O que é |
|---|---|
| `/diagnosis` | Formulário (etapas 1 a 5), conferência, resultado e encaminhamento, numa rota só. `?invite=TOKEN` pré-preenche. |
| `/diagnosis/report` | Relatório de 6 folhas da resposta enviada pelo rascunho do cookie; chama a impressão. |
| `/backoffice` | Abas Respostas, Convites, Usuários (só admin) e Auditoria. |
| `/backoffice/responses/:id/report` | Relatório de uma resposta, para reimprimir (destino do 301 de `/backoffice/relatorio?id=`). |
| `/backoffice/responses.csv` | Planilha das respostas, com o filtro da tela. |

## 2. Estrutura

Front (`src/features`):
- `diagnosis/` — `api/` (server functions `loadDraft`, `saveDraft`, `discardDraft`, `lookupCnpj`, `submitDiagnosis`, `getSubmittedReport` e hooks do Query), `components/` (barra de etapas, campo por tipo de pergunta, matriz, selo de CNPJ, conferência, resultado, encaminhamento, folhas do relatório), `hooks/useDiagnosisForm`.
- `backoffice-responses/`, `backoffice-invitations/`, `backoffice-users/`, `backoffice-audit/` — telas e server functions protegidas por `sessionMiddleware`/`adminMiddleware`.

Back (`src/server`, hexagonal):
- `diagnosis/application` — `saveDraft`, `loadDraft`, `discardDraft`, `submitDiagnosis`, `listResponses`, `getResponse`, `handleResponse`, `exportResponses`. Portas: `DraftRepository`, `ResponseRepository`, `ProtocolGenerator`, `Clock` (data de hoje em Brasília).
- `diagnosis/domain` — ganha as funções puras que montam o que a tela mostra: `reviewItems(answers)`, `resultView(diagnosis, plan)`, `reportSheets(response, diagnosis, plan)`, `csvRows(responses)`, `validateAnswers(answers)` (as mesmas regras da tela, por etapa e completo).
- `invitations/` — `createInvitation`, `listInvitations`, `deleteInvitation`, `openInvitation(token, draftId)`.
- `legacy-import/` — a migração (seção 7).
- CNPJ: o `lookupCompany` que já existe. O QSA nunca sai do servidor; só `requesterInQsa` é guardado no rascunho e na resposta.

## 3. Ciclo de vida do rascunho e da resposta

- Cookie `draft_id`: httpOnly, SameSite=Lax, Secure em produção, 7 dias. Só aponta para a linha do banco.
- **Sem cookie ou rascunho vencido:** nada é criado até a primeira resposta. O primeiro `saveDraft` cria o rascunho (entra no rate limit) e grava o cookie.
- **Com rascunho válido:** a tela mostra "Retomar / Começar de novo" na etapa 1. "Começar de novo" apaga o rascunho e o cookie.
- `saveDraft` grava `{ step, answers }`, apaga do `answers` as chaves internas (`_…`) e não entra no rate limit; o tamanho já é limitado a 256 KB.
- **Resultado:** `submitDiagnosis(draftId)` lê o rascunho do banco (nunca o que o navegador mandar), valida (`aceiteLgpd === 'sim'` e `validateAnswers`), recalcula `diagnose(answers, hoje)` e `buildActionPlan`, e:
  - se o rascunho não tem `responseId`: gera o protocolo `DS-AAMMDD-XXXX` com a data de Brasília e 4 caracteres aleatórios (repete se colidir), cria a `Response` com as projeções e liga o rascunho a ela;
  - se já tem: atualiza a mesma `Response` (respostas, projeções, `updatedAt`), mantendo protocolo e `receivedAt`.
  - Entra no rate limit. Audita `response_received` na criação e `response_updated` na atualização.
- A tela do resultado mostra o recálculo devolvido pelo servidor; enquanto o envio não volta, mostra o cálculo do navegador (paridade provada na fundação).
- Rascunho vencido é apagado quando acessado. A `Response` permanece.
- Triagem: MEI (`ehSimei = 'sim'`) ou regime que não é Simples (e não é `nao_sei`) vai para o encaminhamento com o link da Avaliação Prévia, como no antigo; nada é enviado. "Voltar" desfaz.

Schema (migração nova):
- `DiagnosisDraft`: `responseId Int?` (único), `invitationToken String?`, `invitationOpened Boolean @default(false)`.
- `Response`: `updatedAt DateTime?` (data da última alteração pelo cliente).
- `AUDIT_ACTIONS`: `response_updated`, `legacy_imported`.

## 4. Telas do diagnóstico

Componentes do shadcn com os tokens Auster, o mais perto possível do antigo.

- **Etapas 1 a 5:** barra com as 5 etapas e "Conferência"; só as já passadas são clicáveis. Perguntas, enunciados, dicas, opções e ordem de `QUESTIONS`; caminho curto mostra só as essenciais. Responder apaga o que ficou invisível (como o `set()` antigo). Validação ao clicar em "Próximo" e ao sair do campo, com as mensagens de `VALIDATORS`; rola até o primeiro erro.
- **Matriz:** rodapé com a soma dos pontos médios e aviso fora de 80 a 120 % ("não sei" conta como lacuna). Abaixo de 560 px vira lista com alvos de 44 px; cada célula com rótulo e `aria-label`, `<th scope="row">` (U-01).
- **CNPJ:** consulta pelo servidor ao sair de um CNPJ válido; preenche só campos vazios (`nomeEmpresa`, `ehSimei`, `regimeAtual`) e mostra o selo (razão, município/UF, Simples/MEI, aviso se não ATIVA). Falha não bloqueia: segue manual.
- **Privacidade:** o mesmo bloco de consentimento obrigatório.
- **Conferência:** todas as perguntas visíveis com a resposta; etiqueta "decide" nas que alimentam modalidade ou elegibilidade; "Alterar" leva ao campo e o destaca; bloco de lacunas quando há "não sei".
- **Resultado:** a mesma ordem e os mesmos textos do antigo — aviso de baixa confiança, cartão da decisão, "isto é leitura de perfil", "O que isso significa", as 4 caixas (janela, protocolar até, urgência, confiança), radar, "O que fazer", "Como a Auster pode ajudar", bloco do protocolo e envio, "Três coisas para não errar", conflito e assimetria, "Revisar respostas" e "Baixar o plano de ação em PDF". Saem o alternativo por WhatsApp (nunca configurado) e o painel `?motor=1`.
- **Envio:** automático na primeira exibição do resultado; falha mostra "Não deu para enviar" com botão de tentar de novo; 429 mostra o tempo de espera.
- **Relatório:** 6 folhas (5 sem ações da Auster), CSS de impressão portado, impressão depois de as fontes carregarem com teto de 1,5 s, título do documento trocado durante a impressão.
- **Salvamento:** falha mostra um aviso discreto ("não salvamos suas últimas respostas") e tenta de novo no próximo salvamento.

## 5. Convite

- `?invite=TOKEN` válido: pré-preenche empresa e CNPJ só nos campos vazios, conta uma abertura por rascunho (corrige a contagem dobrada do antigo, que contava de novo no envio), guarda o token no rascunho e liga a resposta ao convite. Token desconhecido abre a página normal.
- Alfabeto do token como no antigo: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, 10 caracteres, gerado no servidor.

## 6. Backoffice

Qualquer usuário logado trata respostas, mexe em convites e exporta; Usuários é só admin. Tudo auditado.

- **Respostas:** contadores por status; lista com empresa e CNPJ, quem respondeu, posição (saída e certeza), urgência e confiança, data, versão e marca de convite; busca por empresa, CNPJ, protocolo ou solicitante; filtro por status; mais recente primeiro; paginação de 50.
- **Detalhe:** dados da empresa, resultado do motor (posição, certeza, saída, urgência, confiança, pontos em aberto, lacunas), alerta do QSA, todas as respostas agrupadas por bloco (chave fora do formulário atual aparece como tal), nota interna, "último tratamento por X em Y", aviso "alterada pelo cliente depois do último tratamento" (quando `updatedAt > handledAt`), botões de status e "Só salvar a nota". Salvar só a nota não muda quem tratou.
- **Relatório:** `/backoffice/responses/:id/report`, recalculado com o motor atual a partir das respostas gravadas e da data do envio, como no antigo.
- **CSV:** colunas fixas do antigo (protocolo, recebido em, situação, tratado por, tratado em, origem, empresa, CNPJ, quem respondeu, e-mail, telefone, versão, saída, posição, certeza, urgência, confiança, pontos em aberto, campos em "não sei", gatilhos, quem respondeu no QSA), depois uma coluna por pergunta e por linha da matriz; `;`, CRLF, BOM, `respostas-simples-AAAA-MM-DD.csv`; respeita o filtro; até 5 000 linhas; audita `spreadsheet_exported`.
- **Convites:** criação com razão social, CNPJ e e-mail (exige nome ou CNPJ, validado no servidor; CNPJ pelo validador); lista com cliente, links copiáveis do diagnóstico e da adesão (`APP_PUBLIC_URL`), aberturas e número de respostas; apagar recusado se houver resposta ou adesão.
- **Usuários (admin):** lista, criar, renomear, trocar papel, ativar/desativar, definir senha, pelos casos de uso de `server/identity` (trava do último admin incluída).
- **Auditoria:** últimas 200 linhas.

## 7. Migração do SQLite antigo

Comando: `pnpm migrate:legacy <caminho do portal.db> [--dry-run]`, rodado no container com `tsx`, lendo o SQLite pelo `node:sqlite` nativo.

- **Ordem:** usuários → convites → respostas → auditoria, numa transação por tabela.
- **Usuários:** `usuario` → `username`, `nome` → `name`, `papel` (equipe → team), `ativo` → `!banned`, `criado_em`, `acesso_em`. Sem senha (o hash antigo é incompatível) e com e-mail sintético `<usuario>@users.invalid`. O admin define as senhas novas pela tela de Usuários. Usuário que já existir no banco novo (ex.: `victor`) é mantido como está.
- **Convites:** todos os campos; `criado_por` vira id pelo nome (nulo se não existir).
- **Respostas:** ids antigos preservados e sequência reiniciada depois (as adesões da Etapa 2 apontam para eles); status traduzidos (nova → new, em_analise → in_review, validada → validated, descartada → discarded); `cnpjDigits` calculado; `solicitante_no_qsa` vira booleano; `tratado_por` vira id pelo nome; `pacote` vai inteiro para `payload`; projeções antigas mantidas (são o que o cliente viu); token de convite inexistente vira nulo; protocolo repetido ganha sufixo (E6) e `(sem protocolo)` vira `SEM-<id>`.
- **Auditoria:** a tabela `eventos` inteira, com as datas originais; ações traduzidas para os nomes de `AUDIT_ACTIONS` (`acesso_negado` → `access_denied`, `resposta_recebida` → `response_received` etc.); `quem` vai para `actorUsername` e, se o usuário existir, para `actorId`. Ao fim, uma linha `legacy_imported` com as contagens.
- **Idempotente:** usa o id antigo como chave; rodar de novo não duplica. `--dry-run` só conta e lista conflitos.
- **Cópia consistente:** copiar `portal.db`, `portal.db-wal` e `portal.db-shm` juntos, de preferência com o portal antigo parado ou por `sqlite3 .backup`. O passo a passo por SSH fica no `AGENTS.md`.

## 8. Testes

- `domain`: as invariantes da tela que ficaram de fora na fundação, sobre os 40 mil preenchimentos — conferência lista exatamente as perguntas visíveis e nenhuma obrigatória em branco; resultado e relatório sem `undefined`/`NaN`/`null` e sem afirmação de mérito econômico; híbrido cita "30 de novembro"; relatório com 5 ou 6 folhas, uma linha do resumo por pergunta de escolha visível e protocolo no formato; a validação aceita todos os preenchimentos gerados. CSV: colunas e escape.
- `application` com fakes: o envio ignora o diagnóstico do navegador, recusa sem consentimento, cria uma vez e atualiza depois com o mesmo protocolo; protocolo com a data de Brasília; abertura do convite contada uma vez por rascunho; salvar só a nota não muda quem tratou; convite usado não é apagado.
- `adapters` (`*.int.test.ts`): rascunho e resposta no Postgres, rascunho vencido, cookie apontando para rascunho inexistente; migração contra um SQLite de exemplo montado no teste (duplicatas, `(sem protocolo)`, token órfão, usuário inexistente), rodada duas vezes.
- Componentes (Testing Library): matriz com rótulos e lista no celular; campo que fica invisível tem a resposta apagada; selo de CNPJ.
- Ponta a ponta (Playwright contra o servidor de desenvolvimento): caminho curto até o resultado; `Response` gravada; F5 mantém o protocolo; voltar, alterar e reenviar atualiza a mesma resposta; relatório abre; convite pré-preenche; nada em `localStorage`/`sessionStorage`; backoffice lista a resposta, muda o status e baixa o CSV.

## Critério de pronto (em hml, pela branch `teste`)

1. Um diagnóstico completo feito no navegador grava a `Response` com as projeções recalculadas pelo servidor.
2. F5 e reenvio não duplicam; alterar depois atualiza a mesma resposta e o backoffice avisa.
3. "Retomar" funciona depois de fechar o navegador.
4. `?invite=` pré-preenche e liga a resposta ao convite.
5. O CNPJ preenche a razão social e o QSA não aparece em lugar nenhum.
6. O PDF sai com o nome certo, pelo cliente e pelo backoffice.
7. O backoffice lista, filtra, trata, exporta o CSV, cria e apaga convites, gerencia usuários e mostra a auditoria.
8. A migração roda em `--dry-run` e de verdade contra uma cópia do `portal.db` de produção, duas vezes sem duplicar.
9. Nada em `localStorage`/`sessionStorage` (verificado no ponta a ponta).
10. `pnpm lint && pnpm typecheck && pnpm test` limpos e o ponta a ponta passando.

## Fora do escopo

- Mudança de conteúdo jurídico.
- Adesões (Etapa 2) e eventos/inscrições/capa (Etapa 3), inclusive na migração.
- Virada de domínio.
