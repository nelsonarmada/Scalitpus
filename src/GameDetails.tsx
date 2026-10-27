import { useState } from 'react'
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Clock3,
  MapPin,
  Search,
  Users,
  X,
} from 'lucide-react'
import {
  gameEntry,
  gameStats,
  initials,
  type Attendance,
  type Board,
  type Game,
  type Identity,
} from './domain'
type Props = {
  board: Board
  game: Game
  identity: Identity | null
  admin: boolean
  busy: boolean
  onBack: () => void
  onRespond: (status: Attendance, gameId: string) => void
  onAttendance: (
    playerId: string,
    status: Attendance,
    gameId: string,
  ) => Promise<void>
}
export default function GameDetails({
  board,
  game,
  identity,
  admin,
  busy,
  onBack,
  onRespond,
  onAttendance,
}: Props) {
  const [search, setSearch] = useState('')
  const stats = gameStats(board, game)
  const me = board.players.find((p) => p.id === identity?.playerId)
  const status = me ? gameEntry(board, game.id, me.id).status : 'pending'
  const past = new Date(game.starts_at) <= new Date()
  const full = stats.attending.length >= game.capacity
  const format = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('pt-PT', {
      timeZone: 'Europe/Lisbon',
      ...options,
    }).format(new Date(game.starts_at))
  return (
    <section className="game-details" aria-labelledby="game-details-title">
      <button className="game-back" onClick={onBack}>
        <ArrowLeft size={16} />
        Voltar aos jogos
      </button>
      <div className="game-enrollment-header">
        <div>
          <span className={`pill ${past ? 'neutral' : 'green'}`}>
            {past ? 'Inscrições encerradas' : 'Inscrições abertas'}
          </span>
          <h2 id="game-details-title">Inscrições do jogo</h2>
          <div className="enrollment-meta">
            <span>
              <CalendarDays size={16} />
              {format({
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
            <span>
              <Clock3 size={16} />
              {format({ hour: '2-digit', minute: '2-digit' })}
            </span>
            <span>
              <MapPin size={16} />
              {game.location}
            </span>
          </div>
          {game.note && <p className="enrollment-note">{game.note}</p>}
        </div>
        <div className="enrollment-self">
          <span>A MINHA INSCRIÇÃO</span>
          <strong>
            {status === 'yes'
              ? 'Estás inscrito neste jogo'
              : status === 'no'
                ? 'Não vais a este jogo'
                : 'Queres alinhar neste jogo?'}
          </strong>
          <button
            className={`button ${status === 'yes' ? 'confirmed' : 'primary'} full`}
            disabled={busy || past || (full && status !== 'yes')}
            onClick={() => onRespond('yes', game.id)}
          >
            <Check size={17} />
            {status === 'yes'
              ? 'Inscrição confirmada'
              : full
                ? 'Jogo completo'
                : 'Inscrever-me neste jogo'}
          </button>
          {status === 'yes' ? (
            <button
              className="rsvp-no"
              disabled={busy || past}
              onClick={() => onRespond('no', game.id)}
            >
              <X size={13} />
              Cancelar a minha inscrição
            </button>
          ) : (
            <button
              className="rsvp-no"
              disabled={busy || past}
              onClick={() => onRespond('no', game.id)}
            >
              Não vou a este jogo
            </button>
          )}
          {past && (
            <small>
              Este jogo já começou.
              {admin
                ? ' A administração pode corrigir o histórico na lista.'
                : ''}
            </small>
          )}
        </div>
      </div>
      <div className="roster-card game-participants">
        <div className="section-heading">
          <div>
            <h2>
              <Users size={18} />
              Participantes deste jogo
              <span className="count-badge">
                {stats.attending.length}/{game.capacity}
              </span>
            </h2>
            <p>
              As inscrições são as mesmas que aparecem na coluna desta data em
              Jogadores.
            </p>
          </div>
          <label className="search-box">
            <Search size={15} />
            <input
              aria-label="Pesquisar participantes do jogo"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Procurar jogador…"
            />
          </label>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">JOGADOR</th>
                <th scope="col">INSCRIÇÃO NESTE JOGO</th>
              </tr>
            </thead>
            <tbody>
              {board.players
                .filter((p) =>
                  p.name
                    .toLocaleLowerCase('pt')
                    .includes(search.toLocaleLowerCase('pt')),
                )
                .map((p, i) => {
                  const entry = gameEntry(board, game.id, p.id)
                  const editable =
                    admin || (p.id === identity?.playerId && !past)
                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="player-cell">
                          <span className={`avatar color-${i % 6}`}>
                            {initials(p.name)}
                          </span>
                          <div>
                            <span className="player-name">
                              {p.name}
                              {p.id === me?.id && (
                                <span className="you-label">Tu</span>
                              )}
                            </span>
                            <span className="player-subtitle">
                              {p.external ? 'Externo' : 'Membro do grupo'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        {editable ? (
                          <div className={`status-select ${entry.status}`}>
                            <span />
                            {entry.status === 'yes'
                              ? 'Inscrito'
                              : entry.status === 'no'
                                ? 'Não vai'
                                : 'Sem resposta'}
                            <select
                              aria-label={`Inscrição de ${p.name} neste jogo`}
                              value={entry.status}
                              disabled={busy}
                              onChange={(e) =>
                                void onAttendance(
                                  p.id,
                                  e.target.value as Attendance,
                                  game.id,
                                )
                              }
                            >
                              <option value="pending">Sem resposta</option>
                              <option value="yes">Inscrito</option>
                              <option value="no">Não vai</option>
                            </select>
                          </div>
                        ) : (
                          <span className={`status-pill ${entry.status}`}>
                            <span />
                            {entry.status === 'yes'
                              ? 'Inscrito'
                              : entry.status === 'no'
                                ? 'Não vai'
                                : 'Sem resposta'}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
