import { expect, test, type Page } from '@playwright/test'
import { E2E_OPERATOR, E2E_REGULARIZATION, createEvent, login, nothingLocal, registerInSession, useOwnAddress } from './fill'

const PROTOCOL = /INS-\d{8}-[A-Z0-9]{5}/

async function freshVisitor(browser: import('@playwright/test').Browser): Promise<Page> {
  const visitor = await (await browser.newContext()).newPage()
  await useOwnAddress(visitor)
  return visitor
}

async function protocolOf(page: Page) {
  return ((await page.getByText(PROTOCOL).first().textContent()) ?? '').match(PROTOCOL)?.[0]
}

test('a capa mostra as quatro portas e não guarda nada local', async ({ page }) => {
  await page.goto('/')
  for (const card of ['Diagnóstico', 'Termo de opção', 'Encontros', 'Falar com a Auster']) {
    await expect(page.getByRole('heading', { name: card })).toBeVisible()
  }
  await expect(page.getByRole('link', { name: 'Fazer o diagnóstico' }).first()).toHaveAttribute('href', '/diagnosis')
  await expect(page.locator('a[href^="/backoffice"]')).toHaveCount(0)
  expect(await page.evaluate(nothingLocal)).toEqual([0, 0])
})

test('o admin publica um evento de uma vaga; a inscrição entra e o segundo visitante encontra a sessão lotada', async ({ page, browser }) => {
  await login(page)
  const title = `Encontro ${Date.now()}`
  const { id, slug } = await createEvent(page, title, 1)

  const visitor = await freshVisitor(browser)
  await visitor.goto('/events')
  await expect(visitor.getByRole('link', { name: new RegExp(title) })).toBeVisible()
  await visitor.goto(`/events/${slug}`)
  await expect(visitor.getByRole('heading', { level: 1, name: title })).toBeVisible()
  await registerInSession(visitor, { name: 'Ana Souza', email: `ana.${Date.now()}@exemplo.com.br` })
  await expect(visitor.getByRole('heading', { name: 'Inscrição confirmada' })).toBeVisible()
  const protocol = await protocolOf(visitor)
  expect(protocol).toBeTruthy()
  expect(await visitor.evaluate(nothingLocal)).toEqual([0, 0])

  const late = await freshVisitor(browser)
  await late.goto(`/events/${slug}`)
  await expect(late.getByRole('heading', { name: 'Todas as vagas foram preenchidas' })).toBeVisible()

  await page.goto(`/backoffice?tab=events&event=${id}`)
  const line = page.locator('tr', { hasText: 'Ana Souza' })
  await expect(line).toContainText('Inscrita')
  await line.getByRole('button', { name: 'Presente' }).click()
  await expect(line).toContainText('Presente')
  const csv = await page.request.get(`/backoffice/events/${id}/registrations.csv`)
  expect(csv.status()).toBe(200)
  const body = await csv.text()
  expect(body.replace(/^﻿/, '').startsWith('protocolo;inscrito em (Brasilia);situacao;evento;encontro')).toBe(true)
  expect(body).toContain(protocol ?? 'sem protocolo')
})

test('quem repete a inscrição enquanto há vaga recebe o protocolo original; outra pessoa fecha a lotação', async ({ page, browser }) => {
  await login(page)
  const { slug } = await createEvent(page, `Repetido ${Date.now()}`, 2)
  const stamp = Date.now()
  const person = { name: 'Beto Lima', email: `beto.${stamp}@exemplo.com.br` }

  const first = await freshVisitor(browser)
  await first.goto(`/events/${slug}`)
  await registerInSession(first, person)
  await expect(first.getByRole('heading', { name: 'Inscrição confirmada' })).toBeVisible()
  const protocol = await protocolOf(first)
  expect(protocol).toBeTruthy()

  // Mesma pessoa, e-mail em maiúsculas, enquanto ainda há uma vaga.
  const second = await freshVisitor(browser)
  await second.goto(`/events/${slug}`)
  await registerInSession(second, { ...person, email: person.email.toUpperCase() })
  await expect(second.getByRole('heading', { name: 'Você já estava inscrito' })).toBeVisible()
  expect(await protocolOf(second)).toBe(protocol)

  const other = await freshVisitor(browser)
  await other.goto(`/events/${slug}`)
  await registerInSession(other, { name: 'Carla Dias', email: `carla.${stamp}@exemplo.com.br` })
  await expect(other.getByRole('heading', { name: 'Inscrição confirmada' })).toBeVisible()

  const late = await freshVisitor(browser)
  await late.goto(`/events/${slug}`)
  await expect(late.getByRole('heading', { name: 'Todas as vagas foram preenchidas' })).toBeVisible()
})

test('o operador gerencia eventos, mas não baixa a planilha: sem botão e 403 no servidor', async ({ page, browser }) => {
  await login(page)
  const { id } = await createEvent(page, `Operador ${Date.now()}`, 5)

  const operator = await (await browser.newContext()).newPage()
  await login(operator, E2E_OPERATOR)
  await operator.goto(`/backoffice?tab=events&event=${id}`)
  await expect(operator.getByRole('button', { name: 'Salvar alterações' })).toBeVisible()
  await expect(operator.getByRole('link', { name: 'Baixar inscritos (CSV)' })).toHaveCount(0)
  expect((await operator.request.get(`/backoffice/events/${id}/registrations.csv`)).status()).toBe(403)
  expect(await operator.evaluate(nothingLocal)).toEqual([0, 0])
})

test('rascunho aberto pelo endereço é 404 para visitante e para quem não tem view_events; o admin vê a página', async ({ page, browser }) => {
  await login(page)
  const title = `Rascunho ${Date.now()}`
  const { slug } = await createEvent(page, title, 3, false)
  expect(slug).not.toBe('')

  const visitor = await freshVisitor(browser)
  await visitor.goto(`/events/${slug}`)
  await expect(visitor.getByText('Evento não encontrado.')).toBeVisible()
  await expect(visitor.getByRole('heading', { level: 1, name: title })).toHaveCount(0)

  // Papel sem view_events: a regularização (a aba Eventos nem aparece para ela).
  const regularization = await (await browser.newContext()).newPage()
  await login(regularization, E2E_REGULARIZATION)
  await regularization.goto(`/events/${slug}`)
  await expect(regularization.getByText('Evento não encontrado.')).toBeVisible()
  await expect(regularization.getByRole('heading', { level: 1, name: title })).toHaveCount(0)

  await page.goto(`/events/${slug}`)
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
})
