import { useState } from 'react'
import {
  ArrowRightLeft,
  ChevronDown,
  CircleHelp,
  Link2,
  Search,
  UserPlus,
} from 'lucide-react'
import {
  gameEntry,
  initials,
  money,
  type Attendance,
  type Board,
  type Identity,
} from './domain'

type Props = {
  board: Board
  admin: boolean
  mergeAllowed: boolean
  identity: Identity | null
  busy: boolean
  demo: boolean
  syncError: boolean
  activeGameId?: string
  onAttendance: (
    playerId: string,
    status: Attendance,
    gameId: string,
  ) => Promise<void>
  onMerge: () => void
  onAdd: () => void
  onAccess: (playerId: string) => void
}
export default function ParticipationGrid({
  board,
  admin,
  mergeAllowed,
  identity,
  busy,
  demo,
  syncError,
  activeGameId,
  onAttendance,
  onMerge,
  onAdd,
  onAccess,
}: Props) {
  const [search, setSearch] = useState(''),
    [externals, setExternals] = useState(false)
  const games = [...board.games].sort((a, b) =>
    a.starts_at.localeCompare(b.starts_at),
  )
  const players = board.players.filter(
    (p) =>
      p.name.toLocaleLowerCase('pt').includes(search.toLocaleLowerCase('pt')) &&
      (!externals || p.external),
  )
  const date = (iso: string) =>
    new Intl.DateTimeFormat('pt-PT', {
      timeZone: 'Europe/Lisbon',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(iso))
  return (
    <div
      className={`roster-card participation-card ${admin ? '' : 'attendance-only'}`}
    >
      <div className="section-heading">
        <div>
          <h2>
            Mapa de participações{' '}
            <span className="count-badge">{board.players.length}</span>
          </h2>
          <p>
            {admin
              ? 'Presenças por data e totais das transferências.'
              : 'Marca a tua presença nas datas dos jogos.'}
          </p>
        </div>
        {admin && (
          <div className="grid-actions">
            {mergeAllowed && (
              <button className="button compact secondary" onClick={onMerge}>
                <ArrowRightLeft size={15} />
                Fundir jogadores
              </button>
            )}
            <button className="button compact secondary" onClick={onAdd}>
              <UserPlus size={16} />
              Adicionar jogador
            </button>
          </div>
        )}
      </div>
      <div className="table-toolbar">
        <div
          className="filter-tabs"
          role="tablist"
          aria-label="Filtrar jogadores"
        >
          <button
            role="tab"
            aria-selected={!externals}
            onClick={() => setExternals(false)}
          >
            Todos <span>{board.players.length}</span>
          </button>
          <button
            role="tab"
            aria-selected={externals}
            onClick={() => setExternals(true)}
          >
            Externos{' '}
            <span>{board.players.filter((p) => p.external).length}</span>
          </button>
        </div>
        <label className="search-box">
          <Search size={15} />
          <input
            aria-label="Pesquisar jogador"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Procurar jogador…"
          />
        </label>
      </div>
      <div className="ledger-info">
        <CircleHelp size={14} />
        <span>
          {admin && (
            <>
              <strong>Valor pago</strong> soma as parcelas válidas.{' '}
            </>
          )}
          <strong>X</strong> = presença · <strong>—</strong> = não vai · vazio =
          sem resposta.
        </span>
      </div>
      <div
        className="table-scroll ledger-scroll"
        role="region"
        aria-label="Grelha de participações"
        tabIndex={0}
      >
        <table className="ledger-table">
          <thead>
            <tr>
              <th scope="col" className="ledger-name">
                Nome
              </th>
              {admin && (
                <th scope="col" className="ledger-amount">
                  Valor pago<small>total acumulado</small>
                </th>
              )}
              {games.map((g) => (
                <th
                  scope="col"
                  className={`ledger-date ${g.id === activeGameId ? 'active-date' : ''}`}
                  key={g.id}
                >
                  {date(g.starts_at)}
                  <small>
                    {g.id === activeGameId ? 'Jogo selecionado' : 'Presença'}
                  </small>
                </th>
              ))}
              {admin && (
                <th scope="col">
                  <span className="sr-only">Acesso pessoal</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {players.map((p, i) => (
              <tr key={p.id}>
                <th scope="row" className="ledger-name">
                  <div className="player-cell">
                    <span className={`avatar color-${i % 6}`}>
                      {initials(p.name)}
                    </span>
                    <div>
                      <div className="player-name">
                        {p.name}
                        {p.id === identity?.playerId && (
                          <span className="you-label">Tu</span>
                        )}
                      </div>
                      <span className="player-subtitle">
                        {p.external
                          ? `Convidado${p.invited_by ? ` de ${p.invited_by.split(' ')[0]}` : ''}`
                          : 'Membro do grupo'}
                      </span>
                    </div>
                    {p.external && (
                      <span className="external-label">Externo</span>
                    )}
                  </div>
                </th>
                {admin && (
                  <td className="ledger-amount">
                    {p.external ? (
                      <span className="exempt">Isento</span>
                    ) : (
                      <span
                        className={`ledger-value ${(p.paid_total_cents || 0) > 0 ? 'has-value' : ''}`}
                        aria-label={`Total pago acumulado de ${p.name}`}
                      >
                        {money(p.paid_total_cents || 0)}
                      </span>
                    )}
                  </td>
                )}
                {games.map((g) => {
                  const status = gameEntry(board, g.id, p.id).status
                  const editable =
                    admin ||
                    (p.id === identity?.playerId &&
                      new Date(g.starts_at) > new Date())
                  return (
                    <td
                      className={`ledger-attendance ${g.id === activeGameId ? 'active-date' : ''}`}
                      key={g.id}
                    >
                      <div
                        className={`ledger-mark ${status} ${editable ? 'editable' : ''}`}
                      >
                        <span aria-hidden="true">
                          {status === 'yes' ? 'X' : status === 'no' ? '—' : ''}
                        </span>
                        {editable ? (
                          <>
                            <ChevronDown size={11} />
                            <select
                              aria-label={`Presença de ${p.name} em ${date(g.starts_at)}`}
                              value={status}
                              disabled={busy}
                              onChange={(e) =>
                                void onAttendance(
                                  p.id,
                                  e.target.value as Attendance,
                                  g.id,
                                )
                              }
                            >
                              <option value="pending">Sem resposta</option>
                              <option value="yes">Presente — X</option>
                              <option value="no">Não vai —</option>
                            </select>
                          </>
                        ) : (
                          <span className="sr-only">
                            {status === 'yes'
                              ? 'Presente'
                              : status === 'no'
                                ? 'Não vai'
                                : 'Sem resposta'}
                          </span>
                        )}
                      </div>
                    </td>
                  )
                })}
                {admin && (
                  <td>
                    <button
                      className="icon-button player-link"
                      aria-label={`Criar novo acesso pessoal para ${p.name}`}
                      title={`Criar novo acesso pessoal para ${p.name}`}
                      disabled={busy}
                      onClick={() => onAccess(p.id)}
                    >
                      <Link2 size={15} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!players.length && (
          <div className="no-results">
            <Search size={24} />
            <strong>Nenhum jogador encontrado</strong>
            <p>Experimenta outro nome ou filtro.</p>
          </div>
        )}
      </div>
      {!games.length && (
        <div className="ledger-info">
          O próximo jogo acrescentará uma coluna de presenças.
        </div>
      )}
      <div className="table-footer">
        <span>
          {players.length} de {board.players.length} jogadores · desliza para
          ver todas as datas
        </span>
        <span className={`live-status ${syncError ? 'sync-error' : ''}`}>
          <span />
          {demo
            ? 'Demonstração local'
            : syncError
              ? 'Ligação interrompida'
              : 'Grupo sincronizado'}
        </span>
      </div>
    </div>
  )
}
