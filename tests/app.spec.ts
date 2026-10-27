import { expect, test, type Page } from '@playwright/test'

async function paymentsFor(page: Page, playerId = 'p1') {
  await page
    .getByRole('button', { name: 'Transações monetárias', exact: true })
    .click()
  await page
    .getByLabel('Filtrar recebimentos por jogador')
    .selectOption(playerId)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('mostra o jogo, guarda a presença e persiste ao recarregar', async ({
  page,
}) => {
  await expect(
    page.getByRole('heading', { name: 'Todos em campo.' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Desta vez não consigo' }).click()
  await expect(
    page.getByRole('heading', { name: 'Fica para a próxima?' }),
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Fica para a próxima?' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Sim, vou jogar' }).click()
  await expect(
    page.getByRole('heading', { name: 'Estás na equipa!' }),
  ).toBeVisible()
})

test('soma parcelas, conserva anulações e persiste o histórico', async ({
  page,
}) => {
  await paymentsFor(page)
  await expect(
    page.getByRole('heading', { name: 'Histórico de recebimentos' }),
  ).toBeVisible()
  await expect(page.locator('.payment-total')).toContainText('60,00')
  await page.getByLabel('Parcela transferida (€)').fill('10,50')
  await page.getByLabel('Observação do recebimento').fill('Parcela de teste')
  await page
    .getByRole('button', { name: 'Registar recebimento', exact: true })
    .click()
  await expect(page.locator('.payment-total')).toContainText('70,50')
  await page
    .getByRole('button', { name: 'Jogadores', exact: false })
    .first()
    .click()
  const total = page.getByLabel('Total pago acumulado de João Silva')
  await expect(total).toContainText('70,50')
  await expect(total.locator('button,input,select')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: /Ver pagamentos de/ }),
  ).toHaveCount(0)
  await paymentsFor(page)

  const row = page.getByRole('row').filter({ hasText: 'Parcela de teste' })
  await row.getByRole('button', { name: /Anular parcela/ }).click()
  await page.getByLabel('Motivo da anulação').fill('Transferência duplicada')
  await page.getByRole('button', { name: 'Confirmar anulação' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.payment-total')).toContainText('60,00')
  await expect(row).toContainText('Anulado')
  await expect(row).toContainText('Transferência duplicada')
  await page.reload()
  await paymentsFor(page)
  await expect(
    page.getByRole('row').filter({ hasText: 'Parcela de teste' }),
  ).toContainText('Anulado')
})

test('utilizador só altera a própria presença e não vê dados financeiros', async ({
  page,
}) => {
  await page.getByLabel('Testar nível de acesso').selectOption('user')
  await expect(
    page.getByRole('button', { name: 'Transações monetárias', exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('columnheader', { name: /Valor pago/ }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Novo jogo', exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Fundir jogadores', exact: true }),
  ).toHaveCount(0)
  await expect(
    page
      .getByRole('row')
      .filter({ hasText: 'Miguel Costa' })
      .getByRole('combobox'),
  ).toHaveCount(0)
  const own = page
    .getByRole('row')
    .filter({ hasText: 'João Silva' })
    .getByRole('combobox')
  await expect(own).toHaveCount(1)
  await own.selectOption('no')
  await expect(own).toHaveValue('no')
})

test('Master pode delegar e revogar fusão sem permitir atribuição por administradores', async ({
  page,
}) => {
  await page.getByLabel('Testar nível de acesso').selectOption('admin')
  await expect(
    page.getByRole('button', { name: 'Novo jogo', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Transações monetárias', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Fundir jogadores', exact: true }),
  ).toHaveCount(0)
  await page.locator('.profile-button').click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByLabel('Email do novo administrador')).toHaveCount(0)
  await page.getByRole('button', { name: 'Fechar janela' }).click()
  await page.getByLabel('Testar nível de acesso').selectOption('master')
  await page.locator('.profile-button').click()
  await page.getByLabel('Email do novo administrador').fill('novo@demo.local')
  await page
    .getByRole('button', { name: 'Dar acesso de administrador' })
    .click()
  await expect(
    page.getByRole('dialog').getByText('novo@demo.local', { exact: true }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Retirar administração a novo@demo.local' })
    .click()
  await expect(
    page.getByRole('dialog').getByText('novo@demo.local', { exact: true }),
  ).toHaveCount(0)
  await page.getByLabel('Permitir fusão a admin@demo.local').check()
  await page.getByRole('button', { name: 'Fechar janela' }).click()
  await page.getByLabel('Testar nível de acesso').selectOption('admin')
  await expect(
    page.getByRole('button', { name: 'Fundir jogadores', exact: true }),
  ).toBeVisible()
  await page.getByLabel('Testar nível de acesso').selectOption('master')
  await page.locator('.profile-button').click()
  await page.getByLabel('Permitir fusão a admin@demo.local').uncheck()
  await page.getByRole('button', { name: 'Fechar janela' }).click()
  await page.getByLabel('Testar nível de acesso').selectOption('admin')
  await expect(
    page.getByRole('button', { name: 'Fundir jogadores', exact: true }),
  ).toHaveCount(0)
})

test('fusão preserva parcelas e une presenças da mesma data', async ({
  page,
}) => {
  await page
    .getByRole('button', { name: 'Fundir jogadores', exact: true })
    .click()
  await page.getByLabel('Ficha a absorver', { exact: true }).selectOption('p2')
  await page.getByLabel('Ficha que fica', { exact: true }).selectOption('p1')
  await page
    .getByLabel('Confirmo que as duas fichas são da mesma pessoa')
    .check()
  await page.getByRole('button', { name: 'Confirmar fusão' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(
    page.getByRole('row').filter({ hasText: 'Miguel Costa' }),
  ).toHaveCount(0)
  await expect(
    page.getByLabel('Total pago acumulado de João Silva'),
  ).toContainText('70,00')
  await expect(
    page
      .getByRole('row')
      .filter({ hasText: 'João Silva' })
      .getByRole('combobox'),
  ).toHaveCount(3)
  await paymentsFor(page)
  await expect(page.getByText('Ficha anterior: Miguel Costa')).toBeVisible()
})

test('cria um jogo e apresenta-o no calendário', async ({ page }) => {
  await page.getByRole('button', { name: 'Novo jogo', exact: true }).click()
  await page.getByLabel('Quando jogamos?').fill('2028-06-21T21:00')
  await expect(page.getByLabel('Valor por membro (€)')).toHaveCount(0)
  await page.getByLabel('Local', { exact: true }).fill('Campo dos Amigos')
  await page
    .getByLabel('Recado para a equipa (opcional)')
    .fill('Levamos bola nova!')
  await page.getByRole('button', { name: 'Criar jogo', exact: true }).click()
  await expect(
    page.getByText('Campo dos Amigos', { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByText('Levamos bola nova!', { exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Jogos', exact: true }).click()
  await expect(
    page.getByRole('button').filter({ hasText: 'Campo dos Amigos' }),
  ).toBeVisible()
})

test('adiciona externo, cria link pessoal e filtra jogadores', async ({
  page,
}) => {
  await page
    .getByRole('button', { name: 'Adicionar jogador', exact: true })
    .click()
  await page.getByLabel('Nome do jogador').fill('Carlos Amigo')
  await page.getByLabel('Jogador externo').check()
  await page.getByLabel('Convidado por (opcional)').selectOption('Miguel Costa')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Adicionar jogador', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'O acesso pessoal está pronto.' }),
  ).toBeVisible()
  await expect(page.getByLabel('Link para partilhar')).toHaveValue(
    /#p=.+&t=demo/,
  )
  await page.getByRole('button', { name: 'Fechar janela' }).click()
  await page.getByRole('tab', { name: 'Externos' }).click()
  await page.getByRole('textbox', { name: 'Pesquisar jogador' }).fill('Carlos')
  await expect(
    page.getByRole('row').filter({ hasText: 'Carlos Amigo' }),
  ).toContainText('Isento')
  await expect(
    page.getByRole('row').filter({ hasText: 'Carlos Amigo' }),
  ).toContainText('Convidado de Miguel')
})

test('partilha pelo WhatsApp e explica limites da demonstração', async ({
  page,
}) => {
  await page
    .getByRole('button', { name: 'Partilhar grupo', exact: true })
    .click()
  await expect(
    page.getByRole('link', { name: 'Partilhar no WhatsApp' }),
  ).toHaveAttribute('href', /^https:\/\/wa.me\/\?text=/)
  await expect(
    page.getByText('As alterações não são partilhadas entre dispositivos.', {
      exact: false,
    }),
  ).toBeVisible()
})

test('o layout funciona em telemóvel sem ultrapassar o ecrã', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(
    page.getByRole('heading', { name: 'Todos em campo.' }),
  ).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await page.getByRole('button', { name: 'Abrir navegação' }).click()
  await page
    .getByRole('button', { name: 'Jogadores', exact: false })
    .first()
    .click()
  await expect(
    page.getByRole('heading', { name: 'A malta do costume.' }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Adicionar jogador', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Fechar janela' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('Visão geral mostra percentagens e o logótipo do clube', async ({
  page,
}) => {
  await expect(
    page.getByRole('heading', { name: 'Relatório de participação' }),
  ).toBeVisible()
  const report = page.getByRole('list', {
    name: 'Percentagem de participação por jogador',
  })
  await expect(
    report.getByRole('listitem', {
      name: 'Participação de João Silva',
      exact: true,
    }),
  ).toContainText('100%')
  await expect(
    report.getByRole('listitem', {
      name: 'Participação de Miguel Costa',
      exact: true,
    }),
  ).toContainText('50%')
  await expect(
    page.getByRole('img', { name: 'Scalipus — Clube de Setúbal', exact: true }),
  ).toBeVisible()
  await page
    .getByRole('textbox', { name: 'Pesquisar no relatório' })
    .fill('Miguel Costa')
  await expect(report.getByRole('listitem')).toHaveCount(1)
})

test('inscrever num jogo específico atualiza Jogadores e a alteração inversa regressa ao jogo', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Novo jogo', exact: true }).click()
  await page.getByLabel('Quando jogamos?').fill('2028-06-21T21:00')
  await page.getByLabel('Local', { exact: true }).fill('Campo de sincronização')
  await page.getByRole('button', { name: 'Criar jogo', exact: true }).click()
  await page.getByLabel('Testar nível de acesso').selectOption('user')
  await page.getByRole('button', { name: 'Jogos', exact: true }).click()
  await page
    .getByRole('button', { name: /Abrir inscrições:.*Campo de sincronização/ })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Inscrições do jogo', exact: true }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Inscrever-me neste jogo', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'Inscrição confirmada', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByLabel('Inscrição de João Silva neste jogo'),
  ).toHaveValue('yes')
  await expect(
    page.getByLabel('Inscrição de Miguel Costa neste jogo'),
  ).toHaveCount(0)
  await page
    .getByRole('button', { name: 'Jogadores', exact: false })
    .first()
    .click()
  const newDate = page.getByLabel('Presença de João Silva em 21/06/2028')
  await expect(newDate).toHaveValue('yes')
  const own = page.getByRole('row').filter({ hasText: 'João Silva' })
  await expect(own.getByRole('combobox')).toHaveCount(2)
  await expect(own.getByRole('combobox').first()).toHaveValue('yes')
  await newDate.selectOption('no')
  await page.getByRole('button', { name: 'Jogos', exact: true }).click()
  await page
    .getByRole('button', { name: /Abrir inscrições:.*Campo de sincronização/ })
    .click()
  await expect(
    page.getByLabel('Inscrição de João Silva neste jogo'),
  ).toHaveValue('no')
  await page
    .getByRole('button', { name: 'Inscrever-me neste jogo', exact: true })
    .click()
  await page.getByRole('button', { name: 'Cancelar a minha inscrição' }).click()
  await expect(
    page.getByLabel('Inscrição de João Silva neste jogo'),
  ).toHaveValue('no')
  await page.getByRole('button', { name: 'Voltar aos jogos' }).click()
  await expect(
    page.getByRole('button', {
      name: /Abrir inscrições:.*Campo de sincronização/,
    }),
  ).toBeVisible()
})

test('administrador inscreve outro jogador e ambos os ecrãs usam o mesmo registo', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Jogos', exact: true }).click()
  await page
    .getByRole('button', { name: /Abrir inscrições:/ })
    .last()
    .click()
  const entry = page.getByLabel('Inscrição de Miguel Costa neste jogo')
  await expect(entry).toHaveValue('yes')
  await entry.selectOption('no')
  await page
    .getByRole('button', { name: 'Jogadores', exact: false })
    .first()
    .click()
  const player = page.getByRole('row').filter({ hasText: 'Miguel Costa' })
  await expect(player.getByRole('combobox').last()).toHaveValue('no')
  await player.getByRole('combobox').last().selectOption('yes')
  await expect(
    page.getByLabel('Total pago acumulado de Miguel Costa'),
  ).toContainText('10,00')
  await page.getByRole('button', { name: 'Jogos', exact: true }).click()
  await page
    .getByRole('button', { name: /Abrir inscrições:/ })
    .last()
    .click()
  await expect(
    page.getByLabel('Inscrição de Miguel Costa neste jogo'),
  ).toHaveValue('yes')
})

test('um utilizador não se pode inscrever num jogo passado', async ({
  page,
}) => {
  await page.getByLabel('Testar nível de acesso').selectOption('user')
  await page.getByRole('button', { name: 'Jogos', exact: true }).click()
  await page
    .getByRole('button', { name: /Abrir inscrições:/ })
    .first()
    .click()
  await expect(
    page.getByText('Inscrições encerradas', { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Inscrição confirmada', exact: true }),
  ).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Cancelar a minha inscrição' }),
  ).toBeDisabled()
  await expect(
    page.getByLabel('Inscrição de João Silva neste jogo'),
  ).toHaveCount(0)
})

test('caixa regista saídas, mantém totais por jogador e conserva anulações', async ({
  page,
}) => {
  await page.getByLabel('Testar nível de acesso').selectOption('admin')
  await paymentsFor(page)
  await expect(page.getByTestId('cash-received')).toContainText('80,00')
  await expect(page.getByTestId('cash-spent')).toContainText('0,00')
  await page
    .getByLabel('Descrição do pagamento')
    .fill('Aluguer do pavilhão — outubro')
  await page.getByLabel('Valor da saída (€)').fill('95,50')
  await page
    .getByRole('button', { name: 'Registar pagamento', exact: true })
    .click()
  await expect(page.getByTestId('cash-spent')).toContainText('95,50')
  await expect(page.getByTestId('cash-balance')).toContainText('-15,50')
  await expect(page.locator('.payment-total')).toContainText('60,00')
  await page.getByLabel('Filtrar recebimentos por jogador').selectOption('p2')
  await expect(page.locator('.payment-total')).toContainText('10,00')
  await expect(page.getByTestId('cash-balance')).toContainText('-15,50')
  await page.reload()
  await paymentsFor(page)
  const row = page
    .getByRole('row')
    .filter({ hasText: 'Aluguer do pavilhão — outubro' })
  await expect(row).toBeVisible()
  await row.getByRole('button', { name: /Anular pagamento/ }).click()
  await page.getByLabel('Motivo da anulação').fill('Valor incorreto')
  await page.getByRole('button', { name: 'Confirmar anulação' }).click()
  await expect(row).toContainText('Anulado')
  await expect(row).toContainText('Valor incorreto')
  await expect(page.getByTestId('cash-spent')).toContainText('0,00')
  await expect(page.getByTestId('cash-balance')).toContainText('80,00')
  await page
    .getByRole('button', { name: /Jogadores/ })
    .first()
    .click()
  await expect(
    page.getByLabel('Total pago acumulado de João Silva'),
  ).toContainText('60,00')
})

test('transações monetárias adaptam-se ao telemóvel', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Abrir navegação' }).click()
  await page
    .getByRole('button', { name: 'Transações monetárias', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Histórico de recebimentos' }),
  ).toBeVisible()
  await page
    .getByRole('heading', { name: 'Histórico de pagamentos' })
    .scrollIntoViewIfNeeded()
  await expect(
    page.getByRole('heading', { name: 'Histórico de pagamentos' }),
  ).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
})
