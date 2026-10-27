import { useState } from 'react'
import { BarChart3, Search } from 'lucide-react'
import { initials, participationReport, type Board } from './domain'
export default function ParticipationReport({ board }: { board: Board }) {
  const [search, setSearch] = useState('')
  const report = participationReport(board)
  const total =
    report[0]?.total ??
    board.games.filter((g) => new Date(g.starts_at) < new Date()).length
  const percent = (value: number) =>
    new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 1 }).format(value) +
    '%'
  return (
    <section
      className="participation-report"
      aria-labelledby="participation-report-title"
    >
      <div className="report-heading">
        <div>
          <span className="report-kicker">
            <BarChart3 size={15} /> ASSIDUIDADE DO GRUPO
          </span>
          <h2 id="participation-report-title">Relatório de participação</h2>
          <p>
            Presenças em jogos passados ÷ {total}{' '}
            {total === 1 ? 'jogo passado' : 'jogos passados'}. Os jogos futuros
            não contam.
          </p>
        </div>
        <label className="search-box">
          <Search size={15} />
          <input
            aria-label="Pesquisar no relatório"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Procurar jogador…"
          />
        </label>
      </div>
      <div
        className="report-grid"
        role="list"
        aria-label="Percentagem de participação por jogador"
      >
        {report
          .filter((r) =>
            r.player.name
              .toLocaleLowerCase('pt')
              .includes(search.toLocaleLowerCase('pt')),
          )
          .map(({ player, attended, total, percentage }, i) => (
            <article
              role="listitem"
              className="participation-item"
              key={player.id}
              aria-label={`Participação de ${player.name}`}
            >
              <div className="report-player">
                <span className={`avatar color-${i % 6}`}>
                  {initials(player.name)}
                </span>
                <div>
                  <strong>{player.name}</strong>
                  <small>
                    {total
                      ? `${attended} de ${total} jogos`
                      : 'Sem jogos passados'}
                    {player.external ? ' · Externo' : ''}
                  </small>
                </div>
                <b>{percentage === null ? '—' : percent(percentage)}</b>
              </div>
              <div
                className="report-track"
                role="progressbar"
                aria-label={`Percentagem de ${player.name}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percentage ?? undefined}
                aria-valuetext={
                  percentage === null
                    ? 'Sem jogos passados'
                    : percent(percentage)
                }
              >
                <span style={{ width: `${percentage ?? 0}%` }} />
              </div>
            </article>
          ))}
      </div>
      {!report.length && (
        <div className="no-results">
          Adiciona jogadores para começar o relatório.
        </div>
      )}
      <div className="report-footnote">
        O cálculo usa as respostas «X» dos jogos cuja data e hora de início já
        passaram. Conta todo o histórico do grupo; respostas em falta não contam
        como presença.
      </div>
    </section>
  )
}
