import { useState, type FormEvent } from 'react'
import { ArrowRightLeft, ShieldCheck } from 'lucide-react'
import { money, type Board } from './domain'
export function MergeForm({
  board,
  busy,
  onMerge,
}: {
  board: Board
  busy: boolean
  onMerge: (source: string, target: string) => Promise<boolean>
}) {
  const [source, setSource] = useState(board.players[1]?.id || ''),
    [target, setTarget] = useState(board.players[0]?.id || '')
  const from = board.players.find((p) => p.id === source),
    to = board.players.find((p) => p.id === target)
  const valid = Boolean(from && to && source !== target)
  const count = new Set(
    board.entries
      .filter(
        (e) =>
          (e.player_id === source || e.player_id === target) &&
          e.status === 'yes',
      )
      .map((e) => e.game_id),
  ).size
  return (
    <>
      <div className="modal-icon">
        <ArrowRightLeft size={25} />
      </div>
      <h2 id="modal-title">Fundir jogadores duplicados</h2>
      <p className="modal-intro">
        Escolhe a ficha a absorver e a ficha que fica. A operação reúne o
        histórico da mesma pessoa.
      </p>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault()
          if (valid) void onMerge(source, target)
        }}
      >
        <label className="field">
          <span>Ficha a absorver</span>
          <select
            aria-label="Ficha a absorver"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            required
          >
            <option value="">Selecionar ficha</option>
            {board.players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Ficha que fica</span>
          <select
            aria-label="Ficha que fica"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            required
          >
            <option value="">Selecionar ficha</option>
            {board.players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        {valid ? (
          <div className="merge-preview">
            <strong>
              {from!.name} → {to!.name}
            </strong>
            <span>
              {count} datas com presença · total resultante{' '}
              {money(
                (from!.paid_total_cents || 0) + (to!.paid_total_cents || 0),
              )}
            </span>
            <p>
              Se ambas têm resposta na mesma data, a presença prevalece. As
              parcelas mantêm-se e são somadas. Se uma parcela foi duplicada,
              anula-a no histórico após a fusão.
            </p>
            <p>
              O nome e o acesso pessoal da ficha que fica são mantidos. O acesso
              da ficha absorvida deixa de funcionar.
            </p>
          </div>
        ) : (
          <p className="amount-error">Seleciona duas fichas diferentes.</p>
        )}
        <label className="checkbox-field">
          <input
            type="checkbox"
            aria-label="Confirmo que as duas fichas são da mesma pessoa"
            required
          />
          <span>
            <strong>Confirmo que as duas fichas são da mesma pessoa</strong>
            <small>
              A ficha absorvida sai da lista ativa e fica arquivada para
              auditoria.
            </small>
          </span>
        </label>
        <button className="button primary full" disabled={busy || !valid}>
          <ArrowRightLeft size={17} />
          Confirmar fusão
        </button>
      </form>
    </>
  )
}
export function StaffPanel({
  board,
  busy,
  onChange,
  onGrantMerge,
}: {
  board: Board
  busy: boolean
  onChange: (email: string, admin: boolean) => Promise<boolean>
  onGrantMerge: (email: string, allowed: boolean) => Promise<boolean>
}) {
  const [email, setEmail] = useState('')
  return (
    <section className="staff-panel">
      <h3>Permissões do grupo</h3>
      <p className="small-help">
        Só o Master pode atribuir ou retirar o nível de administrador.
      </p>
      <div className="staff-list">
        {board.staff?.map((s) => (
          <div key={s.user_id}>
            <span>
              <strong>{s.email}</strong>
              <small>{s.role === 'master' ? 'Master' : 'Administrador'}</small>
            </span>
            {s.role === 'admin' && (
              <label className="merge-permission">
                <input
                  type="checkbox"
                  aria-label={`Permitir fusão a ${s.email}`}
                  checked={s.can_merge === true}
                  disabled={busy}
                  onChange={(e) => void onGrantMerge(s.email, e.target.checked)}
                />
                <span>Permitir fusão</span>
              </label>
            )}
            {s.role === 'admin' && (
              <button
                className="text-action"
                disabled={busy}
                aria-label={`Retirar administração a ${s.email}`}
                onClick={() => void onChange(s.email, false)}
              >
                Retirar
              </button>
            )}
          </div>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void onChange(email, true).then((ok) => {
            if (ok) setEmail('')
          })
        }}
      >
        <label className="field">
          <span>Email do novo administrador</span>
          <input
            aria-label="Email do novo administrador"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <p className="small-help">
          Na versão real, a pessoa deve ter iniciado sessão primeiro.
        </p>
        <button className="button secondary full" disabled={busy}>
          <ShieldCheck size={16} />
          Dar acesso de administrador
        </button>
      </form>
    </section>
  )
}
