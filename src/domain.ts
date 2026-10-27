export type Attendance = 'yes' | 'no' | 'pending'
export type Player = {
  id: string
  name: string
  external: boolean
  invited_by: string | null
  paid_total_cents?: number
  created_at: string
}
export type Game = {
  id: string
  starts_at: string
  location: string
  capacity: number
  note: string
  created_at: string
}
export type Entry = {
  game_id: string
  player_id: string
  status: Attendance
}
export type Role = 'master' | 'admin' | 'user'
export type Payment = {
  id: string
  player_id: string
  amount_cents: number
  paid_on: string | null
  note: string
  kind: 'transfer' | 'opening_balance'
  created_at: string
  recorded_by: string
  voided_at: string | null
  void_reason: string
  original_player_name?: string
}
export type Expense = {
  id: string
  amount_cents: number
  paid_on: string
  description: string
  created_at: string
  recorded_by: string
  voided_at: string | null
  void_reason: string
}
export type ExpenseInput = Pick<
  Expense,
  'amount_cents' | 'paid_on' | 'description'
>
export const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Lisbon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
function validateMovementDate(date: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date ||
    date < '1900-01-01' ||
    date > today()
  )
    throw new Error('Indica uma data válida, até hoje.')
}
export function cashTotals(board: Board) {
  const received = (board.payments || [])
    .filter((p) => !p.voided_at)
    .reduce((sum, p) => sum + p.amount_cents, 0)
  const spent = (board.expenses || [])
    .filter((p) => !p.voided_at)
    .reduce((sum, p) => sum + p.amount_cents, 0)
  return { received, spent, balance: received - spent }
}
export function recordExpense(board: Board, input: ExpenseInput): Board {
  if (
    !Number.isInteger(input.amount_cents) ||
    input.amount_cents <= 0 ||
    input.amount_cents > 100_000_000
  )
    throw new Error('Valor inválido.')
  validateMovementDate(input.paid_on)
  if (
    input.description.trim().length < 3 ||
    input.description.trim().length > 250
  )
    throw new Error('Indica uma descrição entre 3 e 250 caracteres.')
  return {
    ...board,
    expenses: [
      ...(board.expenses || []),
      {
        ...input,
        description: input.description.trim(),
        id: createLocalId(),
        created_at: new Date().toISOString(),
        recorded_by: 'Administração (demo)',
        voided_at: null,
        void_reason: '',
      },
    ],
  }
}
export function voidExpense(board: Board, id: string, reason: string): Board {
  if (reason.trim().length < 3 || reason.trim().length > 250)
    throw new Error('Indica o motivo da anulação.')
  if (!board.expenses?.some((p) => p.id === id && !p.voided_at))
    throw new Error('Pagamento não encontrado ou já anulado.')
  return {
    ...board,
    expenses: board.expenses.map((p) =>
      p.id === id
        ? {
            ...p,
            voided_at: new Date().toISOString(),
            void_reason: reason.trim(),
          }
        : p,
    ),
  }
}
export type Staff = {
  user_id: string
  email: string
  role: 'master' | 'admin'
  can_merge?: boolean
}
export type PaymentInput = {
  player_id: string
  amount_cents: number
  paid_on: string
  note: string
}
export type Board = {
  role?: Role
  can_merge?: boolean
  payments?: Payment[]
  expenses?: Expense[]
  staff?: Staff[]
  group: { id: string; name: string; invite_code: string }
  players: Player[]
  games: Game[]
  entries: Entry[]
}
export type GameInput = Omit<Game, 'id' | 'created_at'>
export type Identity = { playerId: string; token: string }

// randomUUID requires a secure context. Portable demo viewers may use an
// isolated origin, where getRandomValues remains available.
export function createLocalId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return (
    'local-' +
    Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('')
  )
}

export const money = (cents: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(
    cents / 100,
  )
export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0])
    .filter((_, i, a) => i === 0 || i === a.length - 1)
    .join('')
    .toUpperCase()
export function gameEntry(
  board: Board,
  gameId: string,
  playerId: string,
): Entry {
  return (
    board.entries.find(
      (e) => e.game_id === gameId && e.player_id === playerId,
    ) ?? {
      game_id: gameId,
      player_id: playerId,
      status: 'pending',
    }
  )
}
export function gameStats(board: Board, game: Game) {
  const attending = board.players.filter(
    (p) => gameEntry(board, game.id, p.id).status === 'yes',
  )
  return {
    attending,
    pending: board.players.filter(
      (p) => gameEntry(board, game.id, p.id).status === 'pending',
    ),
  }
}
export function setEntry(
  board: Board,
  gameId: string,
  playerId: string,
  change: Pick<Entry, 'status'>,
): Board {
  const current = gameEntry(board, gameId, playerId)
  return {
    ...board,
    entries: [
      ...board.entries.filter(
        (e) => !(e.game_id === gameId && e.player_id === playerId),
      ),
      { ...current, ...change },
    ],
  }
}
export function participationReport(board: Board, now = new Date()) {
  const past = new Set(
    board.games
      .filter(
        (g) =>
          Number.isFinite(Date.parse(g.starts_at)) &&
          new Date(g.starts_at).getTime() < now.getTime(),
      )
      .map((g) => g.id),
  )
  return board.players
    .map((player) => {
      const attended = new Set(
        board.entries
          .filter(
            (e) =>
              e.player_id === player.id &&
              e.status === 'yes' &&
              past.has(e.game_id),
          )
          .map((e) => e.game_id),
      ).size
      return {
        player,
        attended,
        total: past.size,
        percentage: past.size ? (attended / past.size) * 100 : null,
      }
    })
    .sort(
      (a, b) =>
        (b.percentage ?? -1) - (a.percentage ?? -1) ||
        a.player.name.localeCompare(b.player.name, 'pt'),
    )
}
export function canMerge(role: Role, board: Board) {
  if (role === 'master') return true
  if (role !== 'admin') return false
  return board.group.id === 'demo'
    ? board.staff?.find(
        (s) => s.email === 'admin@demo.local' && s.role === 'admin',
      )?.can_merge === true
    : board.can_merge === true
}
export function parsePaidTotal(value: string): number {
  const normalized = value.trim().replace(',', '.')
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized))
    throw new Error('Indica um valor válido, com até duas casas decimais.')
  const [euros, fraction = ''] = normalized.split('.')
  const cents = Number(euros) * 100 + Number(fraction.padEnd(2, '0'))
  if (!Number.isSafeInteger(cents) || cents > 100_000_000)
    throw new Error('O total deve estar entre 0 e 1 000 000 €.')
  return cents
}
export function paymentTotal(board: Board, playerId: string): number {
  return (board.payments || [])
    .filter((p) => p.player_id === playerId && !p.voided_at)
    .reduce((total, p) => total + p.amount_cents, 0)
}
function refreshTotals(board: Board): Board {
  return {
    ...board,
    players: board.players.map((p) => ({
      ...p,
      paid_total_cents: paymentTotal(board, p.id),
    })),
  }
}
export function migrateDemo(board: Board): Board {
  if (board.payments) return board
  return {
    ...board,
    payments: board.players
      .filter((p) => (p.paid_total_cents || 0) > 0)
      .map((p) => ({
        id: createLocalId(),
        player_id: p.id,
        amount_cents: p.paid_total_cents!,
        paid_on: null,
        kind: 'opening_balance' as const,
        note: 'Saldo anterior — parcelas originais indisponíveis',
        created_at: new Date().toISOString(),
        recorded_by: 'Migração',
        voided_at: null,
        void_reason: '',
      })),
  }
}
export function recordPayment(board: Board, input: PaymentInput): Board {
  validateMovementDate(input.paid_on)
  const p = board.players.find((p) => p.id === input.player_id)
  if (!p) throw new Error('Jogador não encontrado.')
  if (p.external) throw new Error('Os jogadores externos estão isentos.')
  if (
    !Number.isInteger(input.amount_cents) ||
    input.amount_cents <= 0 ||
    paymentTotal(board, p.id) + input.amount_cents > 100_000_000
  )
    throw new Error('Valor inválido.')
  return refreshTotals({
    ...board,
    payments: [
      ...(board.payments || []),
      {
        ...input,
        id: createLocalId(),
        kind: 'transfer',
        created_at: new Date().toISOString(),
        recorded_by: 'Administração (demo)',
        voided_at: null,
        void_reason: '',
      },
    ],
  })
}
export function voidPayment(board: Board, id: string, reason: string): Board {
  if (reason.trim().length < 3) throw new Error('Indica o motivo da anulação.')
  if (!board.payments?.some((p) => p.id === id && !p.voided_at))
    throw new Error('Pagamento não encontrado ou já anulado.')
  return refreshTotals({
    ...board,
    payments: board.payments.map((p) =>
      p.id === id
        ? {
            ...p,
            voided_at: new Date().toISOString(),
            void_reason: reason.trim(),
          }
        : p,
    ),
  })
}
export function mergePlayers(
  board: Board,
  sourceId: string,
  targetId: string,
): Board {
  const source = board.players.find((p) => p.id === sourceId),
    target = board.players.find((p) => p.id === targetId)
  if (!source || !target || sourceId === targetId)
    throw new Error('Seleciona duas fichas diferentes.')
  if (
    paymentTotal(board, sourceId) + paymentTotal(board, targetId) >
    100_000_000
  )
    throw new Error('O total resultante ultrapassa o limite.')
  let next = {
    ...board,
    entries: board.entries.filter((e) => e.player_id !== sourceId),
  }
  for (const entry of board.entries.filter((e) => e.player_id === sourceId)) {
    const existing = gameEntry(next, entry.game_id, targetId)
    const status =
      entry.status === 'yes' || existing.status === 'yes'
        ? 'yes'
        : entry.status === 'no' || existing.status === 'no'
          ? 'no'
          : 'pending'
    next = setEntry(next, entry.game_id, targetId, { status })
  }
  return refreshTotals({
    ...next,
    players: board.players
      .filter((p) => p.id !== sourceId)
      .map((p) =>
        p.id === targetId
          ? { ...p, external: p.external && source.external }
          : p,
      ),
    payments: (board.payments || []).map((p) =>
      p.player_id === sourceId
        ? {
            ...p,
            player_id: targetId,
            original_player_name: p.original_player_name || source.name,
          }
        : p,
    ),
  })
}
export function createDemo(): Board {
  const next = new Date()
  const days = (3 - next.getDay() + 7) % 7 || 7
  next.setDate(next.getDate() + days)
  next.setHours(20, 30, 0, 0)
  const previous = new Date(next)
  previous.setDate(previous.getDate() - 7)
  const earlier = new Date(next)
  earlier.setDate(earlier.getDate() - 14)
  const names = [
    'João Silva',
    'Miguel Costa',
    'André Santos',
    'Pedro Ferreira',
    'Tiago Oliveira',
    'Rui Almeida',
    'Diogo Martins',
    'Bruno Rodrigues',
    'Ricardo Lopes',
    'Gonçalo Pereira',
    'David Costa',
    'Tomás Ribeiro',
    'Nuno Sousa',
    'Francisco Gomes',
  ]
  const players = names.map((name, i) => ({
    id: `p${i + 1}`,
    name,
    external: i === 10 || i === 11,
    invited_by: i === 10 ? 'Miguel Costa' : i === 11 ? 'André Santos' : null,
    paid_total_cents: i === 0 ? 6000 : i === 1 || i === 2 ? 1000 : 0,
    created_at: new Date().toISOString(),
  }))
  const games = [
    {
      id: 'next',
      starts_at: next.toISOString(),
      location: 'Pavilhão Municipal',
      capacity: 14,
      note: 'Traz uma camisola clara e outra escura. Chega 10 minutos antes para aquecermos!',
      created_at: new Date().toISOString(),
    },
    {
      id: 'earlier',
      starts_at: earlier.toISOString(),
      location: 'Pavilhão Municipal',
      capacity: 14,
      note: '',
      created_at: new Date().toISOString(),
    },
    {
      id: 'previous',
      starts_at: previous.toISOString(),
      location: 'Pavilhão Municipal',
      capacity: 14,
      note: 'Grande jogo, equipa!',
      created_at: previous.toISOString(),
    },
  ]
  const entries: Entry[] = players.slice(0, 12).map((p) => ({
    game_id: 'next',
    player_id: p.id,
    status: 'yes',
  }))
  entries.push(
    ...players
      .slice(0, 10)
      .filter((p) => p.id !== 'p2' && p.id !== 'p3')
      .map((p) => ({
        game_id: 'previous',
        player_id: p.id,
        status: 'yes' as const,
      })),
  )
  entries.push(
    ...players.slice(0, 2).map((p) => ({
      game_id: 'earlier',
      player_id: p.id,
      status: 'yes' as const,
    })),
  )
  return {
    group: { id: 'demo', name: 'Scalipus', invite_code: 'demo' },
    players,
    games,
    entries,
    role: 'master',
    payments: [
      ...[2000, 2500, 1500].map((amount, i) => ({
        id: `payment-${i}`,
        player_id: 'p1',
        amount_cents: amount,
        paid_on: `2026-10-${String(2 + i * 7).padStart(2, '0')}`,
        note: ['Transferência MB WAY', 'Transferência bancária', 'Reforço'][i],
        kind: 'transfer' as const,
        created_at: new Date().toISOString(),
        recorded_by: 'Nelson (Master)',
        voided_at: null,
        void_reason: '',
      })),
      ...['p2', 'p3'].map((id, i) => ({
        id: `other-payment-${i}`,
        player_id: id,
        amount_cents: 1000,
        paid_on: '2026-10-14',
        note: 'Transferência',
        kind: 'transfer' as const,
        created_at: new Date().toISOString(),
        recorded_by: 'Nelson (Master)',
        voided_at: null,
        void_reason: '',
      })),
    ],
    staff: [
      { user_id: 'demo-master', email: 'master@demo.local', role: 'master' },
      { user_id: 'demo-admin', email: 'admin@demo.local', role: 'admin' },
    ],
  }
}
