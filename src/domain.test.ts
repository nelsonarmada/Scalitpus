import { describe, expect, it } from 'vitest'
import {
  createDemo,
  cashTotals,
  recordExpense,
  voidExpense,
  participationReport,
  canMerge,
  gameEntry,
  gameStats,
  mergePlayers,
  migrateDemo,
  parsePaidTotal,
  paymentTotal,
  recordPayment,
  setEntry,
  voidPayment,
} from './domain'
const transfer = (player_id = 'p1', amount_cents = 1000) => ({
  player_id,
  amount_cents,
  paid_on: '2026-10-26',
  note: 'MB WAY',
})
describe('parcelas, fusões e presenças', () => {
  it('soma as parcelas sem precisar de presença ou jogo', () => {
    const board = createDemo()
    const updated = recordPayment(
      { ...board, games: [], entries: [] },
      transfer('p14'),
    )
    expect(paymentTotal(updated, 'p14')).toBe(1000)
    expect(updated.entries).toEqual([])
    expect(paymentTotal(board, 'p14')).toBe(0)
  })
  it('presenças não alteram pagamentos nem outras datas', () => {
    const board = createDemo(),
      updated = setEntry(board, 'next', 'p1', { status: 'no' })
    expect(paymentTotal(updated, 'p1')).toBe(6000)
    expect(gameEntry(updated, 'previous', 'p1').status).toBe('yes')
    expect(gameStats(updated, updated.games[0]).attending).toHaveLength(11)
  })
  it('anula sem apagar o histórico e recusa segunda anulação', () => {
    const board = createDemo()
    const updated = voidPayment(board, 'payment-0', 'Parcela duplicada')
    expect(paymentTotal(updated, 'p1')).toBe(4000)
    expect(updated.payments).toHaveLength(board.payments!.length)
    expect(
      updated.payments!.find((p) => p.id === 'payment-0')?.void_reason,
    ).toBe('Parcela duplicada')
    expect(() => voidPayment(updated, 'payment-0', 'Duplicado')).toThrow()
    expect(paymentTotal(board, 'p1')).toBe(6000)
  })
  it('recusa externos e montantes não positivos ou inválidos', () => {
    expect(() => recordPayment(createDemo(), transfer('p11'))).toThrow(
      'isentos',
    )
    for (const value of [-1, 0, 0.5, NaN, 100_000_001])
      expect(() => recordPayment(createDemo(), transfer('p1', value))).toThrow()
  })
  it('funde presenças por união e mantém parcelas, incluindo anuladas', () => {
    let board = voidPayment(createDemo(), 'payment-0', 'Duplicado')
    board = setEntry(board, 'earlier', 'p1', { status: 'no' })
    const merged = mergePlayers(board, 'p2', 'p1')
    expect(merged.players).toHaveLength(13)
    expect(merged.players.some((p) => p.id === 'p2')).toBe(false)
    expect(gameEntry(merged, 'earlier', 'p1').status).toBe('yes')
    expect(
      merged.entries.filter(
        (e) => e.game_id === 'next' && e.player_id === 'p1',
      ),
    ).toHaveLength(1)
    expect(paymentTotal(merged, 'p1')).toBe(5000)
    expect(merged.payments).toHaveLength(board.payments!.length)
    expect(
      merged.payments!.some((p) => p.original_player_name === 'Miguel Costa'),
    ).toBe(true)
    expect(() => mergePlayers(board, 'p1', 'p1')).toThrow()
  })
  it('migra totais antigos uma só vez sem inventar parcelas ou datas', () => {
    const board = createDemo()
    delete board.payments
    const migrated = migrateDemo(board)
    expect(paymentTotal(migrated, 'p1')).toBe(6000)
    expect(migrated.payments?.[0]).toMatchObject({
      kind: 'opening_balance',
      paid_on: null,
    })
    expect(migrateDemo(migrated)).toBe(migrated)
  })
  it('lê euros com cêntimos e recusa formatos ambíguos', () => {
    expect(parsePaidTotal('10,05')).toBe(1005)
    expect(parsePaidTotal('70.50')).toBe(7050)
    for (const value of ['-10', '', '1.234', '1e3', '1000000.01'])
      expect(() => parsePaidTotal(value)).toThrow()
  })
})

describe('relatório e autorização de fusão', () => {
  it('calcula sobre jogos passados e exclui confirmações futuras', () => {
    const board = createDemo()
    board.games = board.games.map((g) => ({
      ...g,
      starts_at:
        g.id === 'next'
          ? '2030-01-01T20:00:00Z'
          : g.id === 'previous'
            ? '2026-10-21T20:00:00Z'
            : '2026-10-14T20:00:00Z',
    }))
    const report = participationReport(board, new Date('2026-10-26T12:00:00Z'))
    expect(report.find((r) => r.player.id === 'p1')).toMatchObject({
      attended: 2,
      total: 2,
      percentage: 100,
    })
    expect(report.find((r) => r.player.id === 'p2')).toMatchObject({
      attended: 1,
      total: 2,
      percentage: 50,
    })
    expect(report.find((r) => r.player.id === 'p3')).toMatchObject({
      attended: 0,
      total: 2,
      percentage: 0,
    })
  })
  it('mostra ausência de base de cálculo e não inventa zero por cento', () => {
    const board = createDemo()
    board.games = board.games.map((g) => ({
      ...g,
      starts_at: '2030-01-01T20:00:00Z',
    }))
    expect(
      participationReport(board, new Date('2026-10-26T12:00:00Z')).every(
        (r) => r.total === 0 && r.percentage === null,
      ),
    ).toBe(true)
  })
  it('não duplica uma presença repetida na mesma data', () => {
    const board = createDemo()
    board.entries.push(...board.entries.filter((e) => e.player_id === 'p1'))
    expect(
      participationReport(board, new Date('2035-01-01T00:00:00Z')).find(
        (r) => r.player.id === 'p1',
      ),
    ).toMatchObject({ attended: 3, total: 3, percentage: 100 })
  })
  it('só autoriza Master ou o administrador especificamente delegado', () => {
    let board = createDemo()
    expect(canMerge('master', board)).toBe(true)
    expect(canMerge('admin', board)).toBe(false)
    expect(canMerge('user', board)).toBe(false)
    board = {
      ...board,
      staff: board.staff!.map((s) =>
        s.email === 'admin@demo.local' ? { ...s, can_merge: true } : s,
      ),
    }
    expect(canMerge('admin', board)).toBe(true)
    expect(canMerge('user', board)).toBe(false)
    expect(
      canMerge('admin', {
        ...board,
        group: { ...board.group, id: 'real-group' },
        staff: undefined,
        can_merge: false,
      }),
    ).toBe(false)
  })
})

describe('movimentos da caixa', () => {
  const expense = {
    amount_cents: 9550,
    paid_on: '2026-10-26',
    description: 'Aluguer do pavilhão',
  }
  it('desconta saídas sem alterar o acumulado do jogador, aceita saldo negativo e mantém o histórico', () => {
    const board = createDemo()
    const updated = recordExpense(board, expense)
    expect(cashTotals(updated)).toEqual({
      received: 8000,
      spent: 9550,
      balance: -1550,
    })
    expect(updated.players).toEqual(board.players)
    expect(updated.payments).toEqual(board.payments)
    const annulled = voidExpense(updated, updated.expenses![0].id, 'Duplicado')
    expect(cashTotals(annulled)).toEqual({
      received: 8000,
      spent: 0,
      balance: 8000,
    })
    expect(annulled.expenses).toHaveLength(1)
    expect(annulled.expenses![0].void_reason).toBe('Duplicado')
    expect(() =>
      voidExpense(annulled, annulled.expenses![0].id, 'Duplicado'),
    ).toThrow()
    expect(cashTotals(mergePlayers(updated, 'p2', 'p1'))).toEqual(
      cashTotals(updated),
    )
    expect(
      cashTotals(voidPayment(updated, 'payment-0', 'Duplicado')).balance,
    ).toBe(-3550)
  })
  it('recusa montantes, datas e descrições inválidas', () => {
    for (const value of [-1, 0, 0.5, NaN, 100_000_001])
      expect(() =>
        recordExpense(createDemo(), { ...expense, amount_cents: value }),
      ).toThrow()
    for (const paid_on of ['', '2026-02-30', '2099-01-01', '1899-12-31'])
      expect(() =>
        recordExpense(createDemo(), { ...expense, paid_on }),
      ).toThrow()
    expect(() =>
      recordExpense(createDemo(), { ...expense, description: '  ' }),
    ).toThrow()
    expect(
      cashTotals({ ...createDemo(), payments: undefined, expenses: undefined }),
    ).toEqual({ received: 0, spent: 0, balance: 0 })
  })
})
