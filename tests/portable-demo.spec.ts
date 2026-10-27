import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

test('o HTML autónomo permite responder sem rede ou servidor', async ({
  page,
  context,
}) => {
  const errors: string[] = []
  const requests: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => {
    if (request.url().startsWith('http')) requests.push(request.url())
  })
  await context.setOffline(true)
  await page.setContent(await readFile('scalitpus-demo.html', 'utf8'))
  await expect(
    page.getByRole('heading', { name: 'Todos em campo.' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Desta vez não consigo' }).click()
  await expect(
    page.getByRole('heading', { name: 'Fica para a próxima?' }),
  ).toBeVisible()
  expect(errors).toEqual([])
  expect(requests).toEqual([])
})

test('a demonstração funciona num visualizador isolado sem armazenamento', async ({
  page,
  context,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await context.setOffline(true)
  await page.setContent(
    '<iframe title="Demonstração" sandbox="allow-scripts allow-forms" style="width:100%;height:1000px"></iframe>',
  )
  await page.locator('iframe').evaluate(
    (element, html) => {
      ;(element as HTMLIFrameElement).srcdoc = html
    },
    await readFile('scalitpus-demo.html', 'utf8'),
  )
  const frame = page.frameLocator('iframe')
  await expect(
    frame.getByRole('heading', { name: 'Todos em campo.' }),
  ).toBeVisible()
  await frame
    .getByRole('button', { name: 'Adicionar jogador', exact: true })
    .click()
  await frame.getByLabel('Nome do jogador').fill('Teste Visualizador')
  await frame
    .getByRole('dialog')
    .getByRole('button', { name: 'Adicionar jogador', exact: true })
    .click()
  await expect(
    frame.getByRole('heading', { name: 'O acesso pessoal está pronto.' }),
  ).toBeVisible()
  await frame.getByRole('button', { name: 'Fechar janela' }).click()
  await frame.getByRole('button', { name: 'Jogos', exact: true }).click()
  await expect(
    frame.getByRole('heading', { name: 'O próximo cesto começa aqui.' }),
  ).toBeVisible()
  await frame.getByRole('link', { name: 'Scalipus — início' }).click()
  await expect(
    frame.getByRole('heading', { name: 'Todos em campo.' }),
  ).toBeVisible()
  expect(errors).toEqual([])
})
