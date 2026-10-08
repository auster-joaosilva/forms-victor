# Redefinição de senha por e-mail e senhas em lote

Data: 2026-10-08 · Status: desenho aprovado em conversa com o Victor; aguardando revisão desta spec

Base: portal em produção. A autenticação é do `better-auth` (`src/server/shared/auth/auth.ts`), fechado ao navegador: só `/sign-in/username`, `/get-session`, `/sign-out`, `/ok` e `/error` passam. A gestão de usuário vive em `server/identity`. O envio de e-mail (`server/mail`, caixa `no-reply`) existe, mas nenhum fluxo o usa ainda. Todo usuário tem hoje o e-mail `username@users.invalid`, que não existe.

## Decisões

| # | Decisão |
|---|---|
| R1 | **Regra de senha única**: mínimo de 8 caracteres, com ao menos uma letra, um número e um símbolo. Mora só em `server/identity/domain/user-rules.ts`; o `MINIMUM_PASSWORD` duplicado em `auth.ts` deixa de existir como regra própria (o `better-auth` recebe só o piso de 8). Senhas já gravadas continuam válidas. |
| R2 | **Reset implementado em `server/identity`**, com server functions e rotas públicas próprias. Os endpoints de reset do `better-auth` **não** são abertos ao navegador, em linha com o `AGENTS.md`. |
| R3 | **E-mail real no usuário**, na coluna `email` que já existe (única). O `@users.invalid` é tratado como "sem e-mail". Troca de e-mail é só do admin e vai para a auditoria. |
| R4 | **Pedido de reset por usuário, não por e-mail**, com resposta idêntica exista ou não o usuário, tenha ou não e-mail real. Ninguém descobre quem tem conta. |
| R5 | **Token**: 32 bytes aleatórios, gravado só o hash SHA-256, validade de 1 hora no pedido pelo usuário e de 48 horas no envio em lote pelo admin, uso único; um novo pedido invalida o anterior. |
| R6 | **Redefinir encerra todas as sessões** da pessoa e audita. |
| R7 | **Senhas padrão em lote por script de execução única**, não por tela. O sufixo vem de variável de ambiente na hora de rodar e não entra no repositório. Padrão de execução: só lista; gravar exige `--apply`. |
| R8 | **E-mails por regra, também por script**: `<usuário>@austercontabil.com.br`, com a exceção informada em `--override` (`victor.medeiros=victor@austercontabil.com.br`). Lista antes de gravar. |
| R9 | **Fora desta entrega**: troca obrigatória de senha no primeiro acesso. Recomendada, mas decisão do Victor; entra depois sem refazer nada. |

## 1. Rotas e telas

| Rota | O que é |
|---|---|
| `/forgot-password` | Pede o usuário. Resposta única: "se o usuário existir e tiver e-mail cadastrado, enviamos o link". |
| `/reset-password?token=` | Define a nova senha. O `Referrer-Policy: same-origin` e o `X-Robots-Tag: noindex` que o app já envia em toda resposta impedem o token de vazar por referência e de ser indexado. Token inválido, expirado ou usado mostra a mesma mensagem. |
| `/login` | Ganha o link "Esqueci a senha". |
| `/backoffice?tab=users` | Coluna e campo de e-mail, "Enviar link de redefinição" por usuário e "Enviar para todos com e-mail cadastrado" (admin), e colar uma lista `usuário;e-mail`. |

## 2. Servidor — módulo `identity`

**`domain/`** (puro): `assertPassword` (R1), `isUsableResetToken(token, now)`, `isDeliverableEmail` (formato válido e diferente de `@users.invalid`), `deriveFirstName(username)` e `deriveEmail(username, overrides)` usadas pelos scripts.

**`ports/`**: `PasswordResetTokens` (criar invalidando os anteriores, achar pelo hash, consumir), `ResetMailer` (declarada em `identity`, recebe o `mailSender`), `TokenGenerator`, `Clock`, `RateLimiter`.

**`application/`**: `request-password-reset`, `complete-password-reset`, `send-reset-links` (um ou todos), `set-user-email`, `import-user-emails`.

**`adapters/`**: Prisma para o repositório de tokens, gerador com `node:crypto`, e a ponte para o `mailSender`.

**`composition.ts`**: exporta os casos prontos. O front chega só por `features/auth/api` e `features/backoffice-users/api`.

### Regras de execução

- O envio acontece **depois** de gravar o token, fora da transação. Falha de envio é registrada e não desfaz o token nem aparece para quem pediu (R4).
- O corpo do e-mail leva `text` sempre e `html` opcional, com todo dado escapado. Diz que a caixa não recebe resposta e que, se a pessoa não pediu, basta ignorar.
- Limite de pedidos pelo módulo `rate-limit`, por origem e por usuário. A resposta de limite excedido é a única diferença visível, e não revela se o usuário existe.
- Usuário desativado (`banned`) ou sem e-mail real não recebe e-mail e recebe a mesma resposta.
- O link usa `APP_PUBLIC_URL` como base.
- O "limite por usuário" é um intervalo mínimo de 10 minutos entre dois envios ao mesmo usuário, aplicado em silêncio (a resposta continua igual). O módulo `rate-limit` tem janelas fixas de 5 por minuto e 30 por hora, folgadas demais para e-mail: 30 por hora permitiria encher a caixa de alguém. O limite por origem usa o módulo como está.
- O envio do e-mail do pedido do usuário roda em segundo plano, depois da resposta, para o tempo de resposta não revelar se o usuário existe.

## 3. Dados

- `PasswordResetToken`: `id`, `userId` (`onDelete: Cascade`), `tokenHash` (único), `expiresAt`, `usedAt` opcional, `createdAt`. Índice em `userId`. Tabela `password_reset_tokens`.
- `User.email`: sem mudança de schema; muda o uso (R3).
- Auditoria nova no `AuditLog`: `password_reset_requested`, `password_reset_completed`, `password_reset_links_sent` (com contagem), `user_email_changed`, `passwords_set_in_batch` (com contagem; sem senha).

## 4. Scripts de execução única (`scripts/`)

- **`fill-user-emails.ts`**: aplica R8. Mostra cada `usuário → e-mail`; lista à parte quem não segue `nome.sobrenome`; avisa colisão de e-mail e não grava nenhum dos envolvidos. Padrão: só lista; `--apply` grava e audita.
- **`set-batch-passwords.ts`**: aplica R7. Lê `BATCH_PASSWORD_SUFFIX` do ambiente (recusa rodar sem ele). Primeiro nome = trecho do usuário antes do primeiro `.`, `-` ou `_`, com a inicial maiúscula. Pula desativados, valida cada senha pela regra R1, encerra as sessões e grava uma entrada de auditoria com a contagem. Nunca imprime senha.
- **`send-test-mail.ts`**: envia uma mensagem de teste a um endereço (`--to`) com as variáveis SMTP do ambiente, para conferir a configuração sem passar pelo reset.
- Os dois primeiros rodam contra o banco do `DATABASE_URL` informado: quem executa confere o alvo antes do `--apply`.

## 5. Segurança

- Nenhuma senha, sufixo ou token em log ou no repositório. Só o hash do token no banco.
- Os endpoints `/api/auth/*` continuam como estão.
- Padrão de senha em lote é previsível por natureza: sem a troca obrigatória (R9), a segurança de cada conta depende de cada pessoa trocar. Risco aceito pelo Victor.
- Um e-mail derivado errado manda o link para a caixa de outra pessoa; por isso os scripts listam antes de gravar e a troca de e-mail é auditada.

## 6. Testes

- `domain`, Vitest puro: regra R1 (limites e combinações), validade do token, `deriveFirstName` e `deriveEmail` (com exceção, acento e nome curto).
- `application`: casos de uso com fakes (resposta idêntica para usuário inexistente, desativado e sem e-mail; token usado ou expirado; novo pedido invalida o anterior; sessões encerradas).
- `adapters`: `*.int.test.ts` contra o Postgres (unicidade do hash, invalidação, consumo único, cascade).
- Componentes: telas de pedido e de redefinição.
- E2E: o fluxo completo contra um coletor SMTP local (Mailpit no `docker-compose.yml`, só em desenvolvimento), lendo o e-mail e abrindo o link.

## 7. Como testar o envio

- **Local**: o Mailpit recebe os e-mails e mostra numa tela, sem caixa real. Aponta `SMTP_HOST`, `SMTP_PORT=1025` e usuário/senha quaisquer no `.env` de desenvolvimento. O adaptador só liga TLS na porta 465, então a 1025 funciona em texto puro.
- **Produção**: depois do deploy, `send-test-mail.ts --to <seu e-mail>` ou "Enviar link de redefinição" no seu próprio usuário. Se vier "SMTP não configurado", faltam `SMTP_USER` e `SMTP_PASSWORD` no painel do Dokploy.
- O `.env` local nunca aponta para a caixa de produção.

## 8. Fora do escopo

- Troca obrigatória no primeiro acesso (R9).
- Login por e-mail, verificação de e-mail e autenticação em dois fatores.
- Abrir os endpoints de reset do `better-auth`.
- Uma senha padrão como função permanente do sistema.
