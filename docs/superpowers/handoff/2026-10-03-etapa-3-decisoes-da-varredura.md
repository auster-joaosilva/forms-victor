# Decisões da varredura prévia (prevalecem sobre o plano)

## Geral (todas as tarefas)
- `noUncheckedIndexedAccess` está ligado (`tsconfig.json:8`): use guardas ou `?.` em acesso por índice. Nada de `!` não nulo em teste nem em código (é erro de lint), nada de `as never`.
- Caracteres invisíveis nunca literais: BOM como `'﻿'`; diacríticos como `/[̀-ͯ]/g`.
- `User.id` não tem default (`prisma/schema.prisma:71`): testes de integração passam `id` ao criar usuário.
- Nome do tipo de auditoria é `EventsAuditRecorder` em todo lugar.
- Não duplique lógica: `cnpjDigitsOf` reaproveita `normalizeCnpj` de `src/server/shared/domain/validation.ts`; `sessionLabel` existe só em `events/domain/event.ts` (a Tarefa 4 importa esse).

## Tarefa 2
- `home.ts` e `csv.test`: guardas para `noUncheckedIndexedAccess`.

## Tarefa 3
- `NewRegistration` é plano (sem objeto aninhado). Inclua `createdAt` nele se o adaptador precisar; a Tarefa 4 manda os campos planos.
- O include do Prisma com `orderBy`: `satisfies Prisma.EventInclude`, sem `as const`.
- O teste "índice parcial vira repetida" precisa de fato chamar o repositório: force o caminho do P2002 (ex.: insira por fora da trava uma inscrição ativa igual entre a leitura e a gravação, ou teste o mapeamento do erro numa função pequena exportada) — ou renomeie para o que ele prova. Não deixe teste com nome que mente.
- Exporte a fábrica `makeStorageImageStore` e o `listEventImages`; `storageImageStore` é montado na composition (Tarefa 4).

## Tarefa 4
- Corpo dos testes usa `sessaoId`.
- Use case e fakes usam o `NewRegistration` plano da Tarefa 3; o fake de `RegistrationRow` sem `handledBy/handledAt`; `findById` do fake devolve `{ id, status, eventId }`.
- Composition: `const storageImageStore = makeStorageImageStore({ storeFile, findHousePhoto, listImages: listEventImages })`.
- `setup` do teste tipa o limitador como `RateLimiter` (o `blockAll(42)` compila).
- Importa `sessionLabel` da Tarefa 1.

## Tarefa 5
- O helper `register()` do teste no formato plano, com `eventId`.
- `exportCsv` devolve `null` quando o evento não existe (com teste); a rota da Tarefa 11 responde 404.
- **Upload de imagem NÃO vai por server function** (o `src/start.ts:7` limita o corpo a 256 KiB; base64 de capa passa disso). O caso de uso `uploadImage(actor, kind, bytes, contentType, originalName)` continua; a Tarefa 10 cria a rota.

## Tarefa 8
- Sem `robots: index, follow`: o `X-Robots-Tag: noindex, nofollow` global (`src/app/security-headers.ts:5`) fica valendo; não declare robots nas páginas de evento.
- Não desestruture `api` sem usar (lint).
- `getAllByText(/terça-feira/)` (as duas sessões caem numa terça).
- `dates.ts`: guardas de índice.

## Tarefa 10
- **Rota de upload própria**: `src/app/routes/backoffice/event-images.ts` com `server.handlers.POST`: `ensureCapability(request, 'manage_events')`, corpo bruto (bytes) com `content-type` da imagem e `?kind=event_cover|speaker_photo&name=<original>`; chama `eventBackoffice.uploadImage`; responde JSON `{ fileId }` ou `{ error }` 4xx. Em `src/start.ts`, essa rota exata ganha limite de corpo de 6 MiB (as demais seguem 256 KiB) — com teste do limite. O painel faz `fetch(..., { method: 'POST', body: blob })` depois de reduzir a imagem no canvas.
- O texto de ajuda do endereço fica fora do `<label>` (para `getByLabelText('Endereço da página')` achar o campo).

## Tarefa 11
- Fixture de `RegistrationRow` com `createdAt`, `jobTitle`, `sessionId`, `sessionFormat`.
- Evento inexistente → 404.
- Teste do corpo do CSV: compare bytes (o `Response.text()` remove o BOM) ou espere sem BOM.

## Tarefa 12
- Inclua `src/server/legacy-import/adapters/migration.int.test.ts` (ou onde estiver o teste existente que chama `makeImportLegacy` e confere a contagem apagada): passe `images` e espere `registrations: 0`.

## Tarefa 13
- O helper `registerInSession` escolhe a sessão: `selectOption({ index: 1 })`.
- O teste chamado "repete a inscrição" precisa repetir de fato (mesma pessoa duas vezes enquanto há vaga → "Você já estava inscrito"); a lotação é provada com outra pessoa.
- A ordem real das abas no `backoffice.spec.ts:26` é Convites e depois Adesões — ajuste o texto, não a tela.
