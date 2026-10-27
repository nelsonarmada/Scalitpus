import { useState, type FormEvent } from 'react'
import { CircleHelp, Plus, Wallet } from 'lucide-react'
import Dialog from './Dialog'
import ExpensesSection from './ExpensesSection'
import {
  money,
  today,
  cashTotals,
  type ExpenseInput,
  parsePaidTotal,
  type Board,
  type Payment,
  type PaymentInput,
} from './domain'
type Props = {
  board: Board
  busy: boolean
  initialPlayer: string
  onRecord: (input: PaymentInput) => Promise<boolean>
  onRecordExpense: (input: ExpenseInput) => Promise<boolean>
  onVoidExpense: (id: string, reason: string) => Promise<boolean>
  onVoid: (id: string, reason: string) => Promise<boolean>
}
export default function PaymentsPage({
  board,
  busy,
  initialPlayer,
  onRecord,
  onVoid,
  onRecordExpense,
  onVoidExpense,
}: Props) {
  const [player, setPlayer] = useState(initialPlayer),
    [amount, setAmount] = useState(''),
    [date, setDate] = useState(today()),
    [note, setNote] = useState(''),
    [error, setError] = useState(''),
    [voiding, setVoiding] = useState<Payment | null>(null),
    [reason, setReason] = useState('')
  const list = [...(board.payments || [])]
    .filter((p) => !player || p.player_id === player)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
  const total = list
    .filter((p) => !p.voided_at)
    .reduce((sum, p) => sum + p.amount_cents, 0)
  async function submit(e: FormEvent) {
    e.preventDefault()
    try {
      const cents = parsePaidTotal(amount)
      if (cents <= 0) throw new Error('A parcela deve ser superior a zero.')
      if (!player) throw new Error('Seleciona um jogador.')
      if (date > today() || date < '1900-01-01')
        throw new Error('Indica a data em que o dinheiro foi transferido.')
      setError('')
      if (
        await onRecord({
          player_id: player,
          amount_cents: cents,
          paid_on: date,
          note: note.trim(),
        })
      ) {
        setAmount('')
        setNote('')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Valor inválido.')
    }
  }
  const totals = cashTotals(board)
  return (
    <div className="transactions-page">
      <section className="cash-summary" aria-label="Resumo da caixa">
        <div>
          <span>Total recebido</span>
          <strong data-testid="cash-received">{money(totals.received)}</strong>
        </div>
        <div>
          <span>Total pago</span>
          <strong data-testid="cash-spent">{money(totals.spent)}</strong>
        </div>
        <div className={totals.balance < 0 ? 'negative-balance' : ''}>
          <span>Saldo disponível</span>
          <strong data-testid="cash-balance">{money(totals.balance)}</strong>
        </div>
        <p>
          Totais do grupo · movimentos válidos de todo o histórico. O filtro por
          jogador aplica-se apenas aos recebimentos.
        </p>
      </section>
      <section className="payments-layout">
        <div className="roster-card payments-history">
          <div className="section-heading">
            <div>
              <h2>Histórico de recebimentos</h2>
              <p>Parcelas transferidas, datas e quem as registou.</p>
            </div>
            <span className="access-chip">Acesso reservado</span>
          </div>
          <div className="payments-filter">
            <label className="field">
              <span>Filtrar por jogador</span>
              <select
                aria-label="Filtrar recebimentos por jogador"
                value={player}
                onChange={(e) => setPlayer(e.target.value)}
              >
                <option value="">Todos os jogadores</option>
                {board.players
                  .filter((p) => !p.external)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </label>
            <div className="payment-total">
              <span>Total válido {player ? 'do jogador' : 'do grupo'}</span>
              <strong>{money(total)}</strong>
            </div>
          </div>
          <div className="table-scroll">
            <table className="payment-history-table">
              <thead>
                <tr>
                  <th>JOGADOR / DATA</th>
                  <th>PARCELA</th>
                  <th>REGISTO</th>
                  <th>AÇÃO</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => {
                  const name =
                    board.players.find((x) => x.id === p.player_id)?.name ||
                    'Jogador'
                  return (
                    <tr
                      key={p.id}
                      className={p.voided_at ? 'voided-payment' : ''}
                    >
                      <td>
                        <strong>{name}</strong>
                        <small>
                          {p.paid_on
                            ? p.paid_on.split('-').reverse().join('/')
                            : 'Saldo anterior · data não conhecida'}
                        </small>
                        {p.original_player_name &&
                          p.original_player_name !== name && (
                            <small>
                              Ficha anterior: {p.original_player_name}
                            </small>
                          )}
                      </td>
                      <td>
                        <strong>{money(p.amount_cents)}</strong>
                        {p.voided_at && (
                          <small className="void-label">Anulado</small>
                        )}
                      </td>
                      <td>
                        <span>{p.note || 'Transferência'}</span>
                        <small>
                          {p.recorded_by} ·{' '}
                          {new Intl.DateTimeFormat('pt-PT', {
                            timeZone: 'Europe/Lisbon',
                            dateStyle: 'short',
                            timeStyle: 'short',
                          }).format(new Date(p.created_at))}
                        </small>
                        {p.voided_at && <small>Motivo: {p.void_reason}</small>}
                      </td>
                      <td>
                        {!p.voided_at && (
                          <button
                            className="text-action"
                            disabled={busy}
                            aria-label={`Anular parcela de ${money(p.amount_cents)} de ${name}`}
                            onClick={() => {
                              setVoiding(p)
                              setReason('')
                            }}
                          >
                            Anular
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {!list.length && (
              <div className="no-results">
                <Wallet size={27} />
                <strong>Ainda não há parcelas registadas</strong>
                <p>O administrador pode registar a primeira transferência.</p>
              </div>
            )}
          </div>
        </div>
        <aside className="payment-entry-card">
          <div className="modal-icon">
            <Wallet size={24} />
          </div>
          <h2>Registar recebimento</h2>
          <p>
            Acrescenta uma transferência. O total é calculado a partir do
            histórico.
          </p>
          <form onSubmit={(e) => void submit(e)}>
            <label className="field">
              <span>Jogador</span>
              <select
                aria-label="Jogador do pagamento"
                value={player}
                onChange={(e) => setPlayer(e.target.value)}
                required
              >
                <option value="">Selecionar jogador</option>
                {board.players
                  .filter((p) => !p.external)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="field">
              <span>Parcela transferida (€)</span>
              <input
                aria-label="Parcela transferida (€)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                required
                maxLength={12}
                placeholder="Ex.: 10,00"
              />
            </label>
            <label className="field">
              <span>Data da transferência</span>
              <input
                aria-label="Data da transferência"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min="1900-01-01"
                max={today()}
                required
              />
            </label>
            <label className="field">
              <span>Observação (opcional)</span>
              <input
                aria-label="Observação do recebimento"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={250}
                placeholder="Ex.: MB WAY"
              />
            </label>
            {error && (
              <p className="amount-error" role="alert">
                {error}
              </p>
            )}
            <button className="button primary full" disabled={busy}>
              <Plus size={17} />
              Registar recebimento
            </button>
          </form>
          <div className="form-tip">
            <CircleHelp size={16} />
            Uma parcela incorreta pode ser anulada com motivo. O registo
            original fica no histórico.
          </div>
        </aside>
        {voiding && (
          <Dialog
            titleId="void-title"
            onClose={() => setVoiding(null)}
            busy={busy}
          >
            <h2 id="void-title">Anular esta parcela?</h2>
            <p className="modal-intro">
              {money(voiding.amount_cents)} deixam de contar para o total. O
              histórico mantém o registo e o motivo.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void onVoid(voiding.id, reason).then((ok) => {
                  if (ok) setVoiding(null)
                })
              }}
            >
              <label className="field">
                <span>Motivo da anulação</span>
                <input
                  aria-label="Motivo da anulação"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  minLength={3}
                  maxLength={250}
                />
              </label>
              <button className="button primary full" disabled={busy}>
                Confirmar anulação
              </button>
            </form>
          </Dialog>
        )}
      </section>
      <ExpensesSection
        board={board}
        busy={busy}
        onRecord={onRecordExpense}
        onVoid={onVoidExpense}
      />
    </div>
  )
}
