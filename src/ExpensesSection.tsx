import { useState, type FormEvent } from 'react'
import { CircleHelp, Plus, Wallet } from 'lucide-react'
import Dialog from './Dialog'
import {
  money,
  parsePaidTotal,
  today,
  type Board,
  type Expense,
  type ExpenseInput,
} from './domain'

type Props = {
  board: Board
  busy: boolean
  onRecord: (input: ExpenseInput) => Promise<boolean>
  onVoid: (id: string, reason: string) => Promise<boolean>
}
export default function ExpensesSection({
  board,
  busy,
  onRecord,
  onVoid,
}: Props) {
  const [amount, setAmount] = useState(''),
    [date, setDate] = useState(today()),
    [description, setDescription] = useState(''),
    [error, setError] = useState(''),
    [voiding, setVoiding] = useState<Expense | null>(null),
    [reason, setReason] = useState('')
  const list = [...(board.expenses || [])].sort(
    (a, b) =>
      b.paid_on.localeCompare(a.paid_on) ||
      b.created_at.localeCompare(a.created_at),
  )
  async function submit(e: FormEvent) {
    e.preventDefault()
    try {
      const cents = parsePaidTotal(amount)
      if (cents <= 0) throw new Error('O pagamento deve ser superior a zero.')
      if (date > today() || date < '1900-01-01')
        throw new Error('Indica a data em que o pagamento foi feito.')
      if (description.trim().length < 3)
        throw new Error('Indica uma descrição com pelo menos 3 caracteres.')
      setError('')
      if (
        await onRecord({
          amount_cents: cents,
          paid_on: date,
          description: description.trim(),
        })
      ) {
        setAmount('')
        setDescription('')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Valor inválido.')
    }
  }
  return (
    <section className="payments-layout" aria-label="Saídas da caixa">
      <div className="roster-card payments-history">
        <div className="section-heading">
          <div>
            <h2>Histórico de pagamentos</h2>
            <p>Saídas da caixa para o pavilhão e outras despesas do grupo.</p>
          </div>
          <span className="access-chip">Acesso reservado</span>
        </div>
        <div className="table-scroll">
          <table className="payment-history-table">
            <thead>
              <tr>
                <th>DESCRIÇÃO / DATA</th>
                <th>VALOR</th>
                <th>REGISTO</th>
                <th>AÇÃO</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className={p.voided_at ? 'voided-payment' : ''}>
                  <td>
                    <strong>{p.description}</strong>
                    <small>{p.paid_on.split('-').reverse().join('/')}</small>
                  </td>
                  <td>
                    <strong>{money(p.amount_cents)}</strong>
                    {p.voided_at && (
                      <small className="void-label">Anulado</small>
                    )}
                  </td>
                  <td>
                    <span>{p.recorded_by}</span>
                    <small>
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
                        aria-label={`Anular pagamento de ${money(p.amount_cents)} — ${p.description}`}
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
              ))}
            </tbody>
          </table>
          {!list.length && (
            <div className="no-results">
              <Wallet size={27} />
              <strong>Ainda não há pagamentos registados</strong>
              <p>Regista aqui o aluguer do pavilhão ou outra despesa.</p>
            </div>
          )}
        </div>
      </div>
      <aside className="payment-entry-card">
        <div className="modal-icon">
          <Wallet size={24} />
        </div>
        <h2>Registar pagamento</h2>
        <p>
          Uma saída de dinheiro da caixa. Não altera o total transferido por
          cada jogador.
        </p>
        <form onSubmit={(e) => void submit(e)}>
          <label className="field">
            <span>Descrição do pagamento</span>
            <input
              aria-label="Descrição do pagamento"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              minLength={3}
              maxLength={250}
              placeholder="Ex.: Aluguer do pavilhão — outubro"
            />
          </label>
          <label className="field">
            <span>Valor pago (€)</span>
            <input
              aria-label="Valor da saída (€)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              required
              maxLength={12}
              placeholder="Ex.: 30,00"
            />
          </label>
          <label className="field">
            <span>Data do pagamento</span>
            <input
              aria-label="Data do pagamento"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              min="1900-01-01"
              max={today()}
            />
          </label>
          {error && (
            <p className="amount-error" role="alert">
              {error}
            </p>
          )}
          <button className="button primary full" disabled={busy}>
            <Plus size={17} />
            Registar pagamento
          </button>
        </form>
        <div className="form-tip">
          <CircleHelp size={16} />
          Um pagamento incorreto pode ser anulado com motivo. O registo original
          fica no histórico.
        </div>
      </aside>
      {voiding && (
        <Dialog
          titleId="void-expense-title"
          onClose={() => setVoiding(null)}
          busy={busy}
        >
          <h2 id="void-expense-title">Anular este pagamento?</h2>
          <p className="modal-intro">
            {money(voiding.amount_cents)} deixam de contar como saída da caixa.
            O histórico mantém o registo e o motivo.
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
  )
}
