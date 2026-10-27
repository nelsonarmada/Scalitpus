import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Copy,
  ExternalLink,
  LayoutDashboard,
  Link2,
  LoaderCircle,
  LogOut,
  MapPin,
  Menu,
  MessageCircle,
  Plus,
  Settings2,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import { api, supabase } from './api'
import ParticipationGrid from './ParticipationGrid'
import GameDetails from './GameDetails'
import ParticipationReport from './ParticipationReport'
import BrandLogo from './BrandLogo'
import PaymentsPage from './PaymentsPage'
import { MergeForm, StaffPanel } from './Management'
import {
  createDemo,
  canMerge,
  createLocalId,
  gameEntry,
  gameStats,
  initials,
  setEntry,
  recordPayment,
  recordExpense,
  voidExpense,
  type ExpenseInput,
  voidPayment,
  mergePlayers,
  migrateDemo,
  type PaymentInput,
  type Role,
  type Attendance,
  type Board,
  type GameInput,
  type Identity,
} from './domain'

type Page = 'overview' | 'games' | 'players' | 'payments'
type Modal =
  | 'game'
  | 'player'
  | 'join'
  | 'share'
  | 'login'
  | 'settings'
  | 'help'
  | 'merge'
  | null
const DEMO_KEY = 'scalitpus.demo.v1'
const nav = [
  { id: 'overview' as const, label: 'Visão geral', icon: LayoutDashboard },
  { id: 'games' as const, label: 'Jogos', icon: CalendarDays },
  { id: 'players' as const, label: 'Jogadores', icon: Users },
  { id: 'payments' as const, label: 'Transações monetárias', icon: Wallet },
]
const formatDate = (iso: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('pt-PT', {
    timeZone: 'Europe/Lisbon',
    ...options,
  }).format(new Date(iso))
const time = (iso: string) =>
  formatDate(iso, { hour: '2-digit', minute: '2-digit' })
const readableDate = (iso: string) =>
  formatDate(iso, { weekday: 'long', day: 'numeric', month: 'long' })
function readLocal<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') as T | null
  } catch {
    return null
  }
}
function saveLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* The session remains usable when storage is unavailable. */
  }
}
function Basket({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="2" />
      <path
        d="M4 20h32M20 4v32M8 8c16 7 8 17 24 24M32 8C16 15 24 25 8 32"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  )
}
function Avatar({
  name,
  index = 0,
  small = false,
}: {
  name: string
  index?: number
  small?: boolean
}) {
  return (
    <span className={`avatar color-${index % 6} ${small ? 'small' : ''}`}>
      {initials(name)}
    </span>
  )
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

export default function App() {
  const urlCode = new URLSearchParams(location.search).get('g')
  const [code, setCode] = useState(urlCode || '')
  const demo = !supabase || code === 'demo'
  const [board, setBoard] = useState<Board | null>(() =>
    demo ? migrateDemo(readLocal<Board>(DEMO_KEY) || createDemo()) : null,
  )
  const [identity, setIdentity] = useState<Identity | null>(() =>
    demo ? { playerId: 'p1', token: 'demo' } : null,
  )
  const [role, setRole] = useState<Role>(demo ? 'master' : 'user')
  const admin = role !== 'user'
  const mergeAllowed = board ? canMerge(role, board) : false
  const [email, setEmail] = useState('')
  const [page, setPage] = useState<Page>('overview')
  const [modal, setModal] = useState<Modal>(null)
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null)
  const [openGameId, setOpenGameId] = useState<string | null>(null)
  const [joiningResponse, setJoiningResponse] = useState<Attendance>('yes')
  const [mobileNav, setMobileNav] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(!demo)
  const [toast, setToast] = useState<{
    message: string
    error: boolean
  } | null>(null)
  const [sharedPersonalLink, setSharedPersonalLink] = useState('')
  const [loadError, setLoadError] = useState('')
  const [syncError, setSyncError] = useState(false)
  const notify = (message: string, error = false) =>
    setToast({ message, error })

  useEffect(() => {
    if (toast) {
      const id = setTimeout(() => setToast(null), 5000)
      return () => clearTimeout(id)
    }
  }, [toast])
  useEffect(() => {
    if (demo && board) saveLocal(DEMO_KEY, board)
  }, [board, demo])
  useEffect(() => {
    if (!modal) return
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')
    const previous = document.activeElement as HTMLElement | null
    dialog?.querySelector<HTMLElement>('input, button, select')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModal(null)
      if (e.key !== 'Tab' || !dialog) return
      const items = [
        ...dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input, select, textarea, a[href]',
        ),
      ]
      if (!items.length) return
      if (e.shiftKey && document.activeElement === items[0]) {
        e.preventDefault()
        items.at(-1)?.focus()
      } else if (!e.shiftKey && document.activeElement === items.at(-1)) {
        e.preventDefault()
        items[0]?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = oldOverflow
      document.removeEventListener('keydown', onKey)
      previous?.focus()
    }
  }, [modal])

  const refresh = useCallback(async () => {
    if (demo || !code) return
    const fresh = await api.board(code)
    setBoard(fresh)
    setRole(fresh.role || 'user')
    setLoadError('')
    setSyncError(false)
  }, [code, demo])

  useEffect(() => {
    if (demo) {
      setLoading(false)
      return
    }
    let alive = true
    async function init() {
      try {
        const { data } = await supabase!.auth.getSession()
        if (!alive) return
        setEmail(data.session?.user.email || '')
        let activeCode = code
        if (!activeCode && data.session)
          activeCode = (await api.myGroup()) || ''
        if (activeCode && activeCode !== code) {
          setCode(activeCode)
          history.replaceState({}, '', `?g=${encodeURIComponent(activeCode)}`)
          return
        }
        if (!activeCode) {
          setLoading(false)
          return
        }
        const hash = new URLSearchParams(location.hash.slice(1))
        const saved =
          hash.get('p') && hash.get('t')
            ? { playerId: hash.get('p')!, token: hash.get('t')! }
            : readLocal<Identity>(`scalitpus.identity.${activeCode}`)
        if (saved) {
          setIdentity(saved)
          saveLocal(`scalitpus.identity.${activeCode}`, saved)
          if (hash.get('t'))
            history.replaceState({}, '', location.pathname + location.search)
        }
        await refresh()
      } catch (e) {
        if (alive) setLoadError(errorMessage(e))
      } finally {
        if (alive) setLoading(false)
      }
    }
    void init()
    const { data: listener } = supabase!.auth.onAuthStateChange(
      (_event, session) => {
        if (alive) setEmail(session?.user.email || '')
      },
    )
    const timer = setInterval(() => {
      void refresh().catch(() => setSyncError(true))
    }, 20_000)
    return () => {
      alive = false
      listener.subscription.unsubscribe()
      clearInterval(timer)
    }
  }, [code, demo, refresh, email])

  function errorMessage(e: unknown) {
    return e instanceof Error
      ? e.message
      : 'Não foi possível concluir. Tenta novamente.'
  }
  async function action(
    task: () => Promise<void>,
    message?: string,
    close = false,
  ) {
    if (busy) return
    setBusy(true)
    try {
      await task()
      if (message) notify(message)
      if (close) setModal(null)
    } catch (e) {
      notify(errorMessage(e), true)
    } finally {
      setBusy(false)
    }
  }
  const games = [...(board?.games || [])].sort((a, b) =>
    a.starts_at.localeCompare(b.starts_at),
  )
  const upcoming = games.filter((g) => new Date(g.starts_at) >= new Date())
  const game =
    games.find((g) => g.id === selectedGameId) || upcoming[0] || games.at(-1)
  const stats = board && game ? gameStats(board, game) : null
  const me = board?.players.find((p) => p.id === identity?.playerId)
  const myStatus =
    board && game && me ? gameEntry(board, game.id, me.id).status : 'pending'
  const shareLink = `${location.origin}${location.pathname}?g=${encodeURIComponent(demo ? 'demo' : code)}`
  const shareText = game
    ? `🏀 ${board?.group.name} — próximo jogo!\n${readableDate(game.starts_at)}, às ${time(game.starts_at)}\n📍 ${game.location}\nMarca a tua presença: ${shareLink}`
    : `🏀 Junta-te ao ${board?.group.name}: ${shareLink}`

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value)
      notify('Link copiado! Pronto para partilhar.')
    } catch {
      notify(
        'Não foi possível copiar. Seleciona o link e copia manualmente.',
        true,
      )
    }
  }
  async function attendance(
    playerId: string,
    status: Attendance,
    gameId = game?.id,
  ) {
    if (!board) return
    const target = board.games.find((g) => g.id === gameId)
    if (!target) return
    await action(
      async () => {
        if (
          status === 'yes' &&
          gameEntry(board, target.id, playerId).status !== 'yes' &&
          gameStats(board, target).attending.length >= target.capacity
        )
          throw new Error('O jogo já está completo. Contacta um administrador.')
        if (demo) setBoard(setEntry(board, target.id, playerId, { status }))
        else {
          if (admin) await api.adminRsvp(target.id, playerId, status)
          else if (identity && playerId === identity.playerId)
            await api.rsvp(identity.token, target.id, status)
          else throw new Error('Usa o teu acesso pessoal para marcar presença.')
          await refresh()
        }
      },
      status === 'yes'
        ? 'Presença confirmada.'
        : status === 'no'
          ? 'Resposta guardada.'
          : 'Resposta reposta para pendente.',
    )
  }
  function respond(status: Attendance, gameId = game?.id) {
    if (!identity || !me) {
      setJoiningResponse(status)
      setModal('join')
      return
    }
    void attendance(identity.playerId, status, gameId)
  }
  async function financeAction(task: () => Promise<void>): Promise<boolean> {
    if (!board || !admin || busy) return false
    setBusy(true)
    try {
      await task()
      return true
    } catch (e) {
      notify(errorMessage(e), true)
      return false
    } finally {
      setBusy(false)
    }
  }
  async function savePayment(input: PaymentInput): Promise<boolean> {
    return financeAction(async () => {
      if (demo) setBoard(recordPayment(board!, input))
      else {
        await api.recordPayment(input)
        await refresh()
      }
      notify('Parcela registada. Total atualizado.')
    })
  }
  async function cancelPayment(id: string, reason: string): Promise<boolean> {
    return financeAction(async () => {
      if (demo) setBoard(voidPayment(board!, id, reason))
      else {
        await api.voidPayment(id, reason)
        await refresh()
      }
      notify('Parcela anulada. O registo mantém-se no histórico.')
    })
  }
  async function saveExpense(input: ExpenseInput): Promise<boolean> {
    return financeAction(async () => {
      if (demo) setBoard(recordExpense(board!, input))
      else {
        await api.recordExpense(board!.group.id, input)
        await refresh()
      }
      notify('Pagamento registado. Saldo da caixa atualizado.')
    })
  }
  async function cancelExpense(id: string, reason: string): Promise<boolean> {
    return financeAction(async () => {
      if (demo) setBoard(voidExpense(board!, id, reason))
      else {
        await api.voidExpense(id, reason)
        await refresh()
      }
      notify('Pagamento anulado. O registo mantém-se no histórico.')
    })
  }
  async function merge(source: string, target: string): Promise<boolean> {
    if (!mergeAllowed) {
      notify(
        'A fusão está reservada ao Master ou a administradores autorizados.',
        true,
      )
      return false
    }
    return financeAction(async () => {
      if (demo) setBoard(mergePlayers(board!, source, target))
      else {
        await api.merge(source, target)
        await refresh()
      }
      if (identity?.playerId === source) {
        setIdentity(null)
        try {
          localStorage.removeItem(`scalitpus.identity.${code}`)
        } catch {
          /* storage may be unavailable */
        }
      }
      setModal(null)
      notify('Fichas fundidas. Presenças e pagamentos reunidos.')
    })
  }
  async function changeAdmin(
    email: string,
    isAdmin: boolean,
  ): Promise<boolean> {
    if (role !== 'master') return false
    return financeAction(async () => {
      if (demo) {
        const staff = (board!.staff || []).filter(
          (s) => s.email !== email || s.role === 'master',
        )
        if (isAdmin && !staff.some((s) => s.email === email))
          staff.push({ user_id: createLocalId(), email, role: 'admin' })
        setBoard({ ...board!, staff })
      } else {
        await api.manageAdmin(board!.group.id, email, isAdmin)
        await refresh()
      }
      notify('Permissões atualizadas.')
    })
  }
  async function grantMerge(email: string, allowed: boolean): Promise<boolean> {
    if (role !== 'master') return false
    return financeAction(async () => {
      if (demo)
        setBoard({
          ...board!,
          staff: (board!.staff || []).map((s) =>
            s.email === email && s.role === 'admin'
              ? { ...s, can_merge: allowed }
              : s,
          ),
        })
      else {
        await api.grantMerge(board!.group.id, email, allowed)
        await refresh()
      }
      notify(
        allowed
          ? 'Permissão de fusão atribuída.'
          : 'Permissão de fusão retirada.',
      )
    })
  }
  function submitGame(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!board || !admin) return
    const form = new FormData(e.currentTarget)
    const input: GameInput = {
      starts_at: new Date(String(form.get('date'))).toISOString(),
      location: String(form.get('location')).trim(),
      capacity: Number(form.get('capacity')),
      note: String(form.get('note')).trim(),
    }
    void action(
      async () => {
        if (demo) {
          const id = createLocalId()
          setBoard({
            ...board,
            games: [
              ...board.games,
              { id, ...input, created_at: new Date().toISOString() },
            ],
          })
          setSelectedGameId(id)
        } else {
          await api.game(board.group.id, input)
          await refresh()
          setSelectedGameId(null)
        }
        setPage('overview')
      },
      'Jogo criado! Já podes partilhá-lo com o grupo.',
      true,
    )
  }
  function submitPlayer(e: FormEvent<HTMLFormElement>, joining = false) {
    e.preventDefault()
    if (!board) return
    const form = new FormData(e.currentTarget)
    const name = String(form.get('name')).trim()
    const external = form.get('external') === 'on'
    const invitedBy = String(form.get('invitedBy') || '').trim() || null
    if (!name) return
    if (
      board.players.some(
        (p) =>
          p.name.trim().toLocaleLowerCase('pt') ===
          name.toLocaleLowerCase('pt'),
      )
    ) {
      notify(
        'Esse nome já está no grupo. Usa o acesso pessoal do jogador ou pede um novo link ao administrador.',
        true,
      )
      return
    }
    void action(async () => {
      let playerId: string
      let token: string
      if (demo) {
        playerId = createLocalId()
        token = 'demo'
        const next = {
          ...board,
          players: [
            ...board.players,
            {
              id: playerId,
              name,
              external,
              paid_total_cents: 0,
              invited_by: invitedBy,
              created_at: new Date().toISOString(),
            },
          ],
        }
        setBoard(
          joining && game
            ? setEntry(next, game.id, playerId, { status: joiningResponse })
            : next,
        )
      } else {
        const result = await (joining
          ? api.join(code, name, external, invitedBy)
          : api.addPlayer(code, name, external, invitedBy))
        playerId = result.player_id
        token = result.token
        if (joining) {
          // Preserve the new member's access even if registration succeeds but
          // their RSVP fails, e.g. because another player took the last place.
          const who = { playerId, token }
          setIdentity(who)
          saveLocal(`scalitpus.identity.${code}`, who)
          setModal(null)
          try {
            if (game) await api.rsvp(token, game.id, joiningResponse)
          } catch (error) {
            await refresh()
            throw error
          }
        }
        await refresh()
      }
      if (joining) {
        const who = { playerId, token }
        setIdentity(who)
        saveLocal(`scalitpus.identity.${code}`, who)
        setModal(null)
        notify(
          joiningResponse === 'yes'
            ? 'Já estás no grupo. Presença confirmada!'
            : 'Já estás no grupo. Resposta guardada!',
        )
      } else {
        setSharedPersonalLink(
          `${shareLink}#p=${encodeURIComponent(playerId)}&t=${encodeURIComponent(token)}`,
        )
        setModal('share')
        notify('Jogador adicionado. Envia-lhe o acesso pessoal.')
      }
    })
  }
  async function playerAccess(playerId: string) {
    await action(async () => {
      const token = demo ? 'demo' : await api.playerLink(playerId)
      setSharedPersonalLink(
        `${shareLink}#p=${encodeURIComponent(playerId)}&t=${encodeURIComponent(token)}`,
      )
      setModal('share')
    })
  }
  function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const loginEmail = String(new FormData(e.currentTarget).get('email')).trim()
    void action(
      async () => {
        if (!supabase || demo)
          throw new Error(
            'Este é um grupo de demonstração. O início de sessão está disponível na versão ligada ao grupo.',
          )
        const { error } = await supabase.auth.signInWithOtp({
          email: loginEmail,
          options: {
            emailRedirectTo: `${location.origin}${location.pathname}${code ? `?g=${encodeURIComponent(code)}` : ''}`,
          },
        })
        if (error) throw new Error(error.message)
      },
      'Enviámos um link de acesso para o teu email. Verifica também o spam.',
      true,
    )
  }

  const titles: Record<Page, [string, string]> = {
    overview: [
      'Todos em campo.',
      'Presenças por data. Valores pagos por jogador. Tudo no mesmo mapa.',
    ],
    games: [
      'O próximo cesto começa aqui.',
      'Combina os jogos. Junta a equipa. O resto acontece em campo.',
    ],
    players: [
      'A malta do costume.',
      'Os de sempre e os amigos que se juntam ao jogo.',
    ],
    payments: [
      'Contas em dia.',
      'Recebimentos dos jogadores, pagamentos e saldo da caixa.',
    ],
  }
  const currentTitle = titles[page]

  return (
    <div className="app-shell">
      {mobileNav && (
        <button
          aria-label="Fechar navegação"
          className="nav-backdrop"
          onClick={() => setMobileNav(false)}
        />
      )}
      <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
        <a
          className="brand"
          href="/"
          aria-label="Scalipus — início"
          onClick={(e) => {
            e.preventDefault()
            setPage('overview')
            setMobileNav(false)
          }}
        >
          <BrandLogo size={106} full />
        </a>
        <div className="workspace-label">O TEU BALNEÁRIO</div>
        <nav aria-label="Navegação principal">
          {nav
            .filter((n) => n.id !== 'payments' || admin)
            .map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={`nav-item ${page === id ? 'active' : ''}`}
                onClick={() => {
                  setPage(id)
                  if (id === 'games') setOpenGameId(null)
                  setMobileNav(false)
                }}
              >
                <Icon size={19} />
                <span>{label}</span>
                {id === 'players' && board && (
                  <span className="nav-count">{board.players.length}</span>
                )}
                {page === id && <span className="nav-active-dot" />}
              </button>
            ))}
        </nav>
        <div className="sidebar-invite">
          <div className="invite-icon">
            <UserPlus size={21} />
          </div>
          <strong>
            Há sempre lugar
            <br />
            para mais um.
          </strong>
          <p>
            O próximo MVP pode estar
            <br />
            no teu grupo de amigos.
          </p>
          <button
            onClick={() => {
              setSharedPersonalLink('')
              setModal('share')
            }}
          >
            Convidar para o grupo <ArrowUpRight size={16} />
          </button>
          <span className="invite-doodle" aria-hidden="true">
            ↗
          </span>
        </div>
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => setModal('help')}>
            <CircleHelp size={19} />
            Como funciona
          </button>
          <div className="group-profile">
            <span className="group-avatar">
              <BrandLogo size={30} />
            </span>
            <div>
              <strong>{board?.group.name || 'O teu grupo'}</strong>
              <span>
                {board?.players.length || 0} jogadores · Basket amador
              </span>
            </div>
            <span className="online-dot" />
          </div>
          <span className="sidebar-footnote">Bons jogos. Boas companhias.</span>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-button"
              aria-label="Abrir navegação"
              onClick={() => setMobileNav(true)}
            >
              <Menu size={22} />
            </button>
            <span className="breadcrumb-group">O meu grupo</span>
            <ChevronRight size={14} />
            <span>{nav.find((n) => n.id === page)?.label}</span>
          </div>
          <div className="topbar-right">
            <span className="private-badge">
              <span /> Grupo privado
            </span>
            <span className="topbar-divider" />
            <button
              className="profile-button"
              onClick={() => setModal(admin ? 'settings' : 'login')}
            >
              <Avatar
                name={me?.name || (admin ? 'Administrador' : 'Visitante')}
                small
              />
              <span>
                {me?.name.split(' ')[0] ||
                  (email ? email.split('@')[0] : 'Visitante')}
                <small>
                  {role === 'master'
                    ? 'Master'
                    : role === 'admin'
                      ? 'Administrador'
                      : 'Jogador'}
                </small>
              </span>
              <ChevronDown size={14} />
            </button>
          </div>
        </header>
        {demo && (
          <div className="demo-bar">
            <Sparkles size={13} />
            <span>
              Estás no modo de demonstração. Os dados ficam apenas neste
              dispositivo.
            </span>
            <label className="demo-role">
              Testar nível{' '}
              <select
                aria-label="Testar nível de acesso"
                value={role}
                onChange={(e) => {
                  setRole(e.target.value as Role)
                  setPage('overview')
                  setModal(null)
                }}
              >
                <option value="master">Master</option>
                <option value="admin">Administrador</option>
                <option value="user">Utilizador</option>
              </select>
            </label>
            <span className="demo-tag">DEMO</span>
          </div>
        )}
        <main>
          <section className="page-heading">
            <div>
              <div className="eyebrow">
                <span /> O JOGO É MELHOR EM EQUIPA
              </div>
              <h1>{currentTitle[0]}</h1>
              <p>{currentTitle[1]}</p>
            </div>
            <div className="heading-actions">
              <button
                className="button secondary"
                onClick={() => {
                  setSharedPersonalLink('')
                  setModal('share')
                }}
              >
                <MessageCircle size={17} />
                Partilhar grupo
              </button>
              {!admin && !me && (
                <button
                  className="button primary"
                  onClick={() => setModal('join')}
                >
                  <UserPlus size={17} />
                  Adicionar o meu nome
                </button>
              )}
              {admin && (
                <button
                  className="button primary"
                  onClick={() => setModal('game')}
                >
                  <Plus size={18} />
                  Novo jogo
                </button>
              )}
            </div>
          </section>

          {loading ? (
            <div className="empty-card">
              <LoaderCircle className="spin" />
              <h2>A preparar o balneário…</h2>
            </div>
          ) : loadError ? (
            <div className="empty-card">
              <CircleHelp size={32} />
              <h2>Não conseguimos abrir este grupo</h2>
              <p>{loadError}</p>
              <button
                className="button primary"
                onClick={() => void action(refresh)}
              >
                Tentar novamente
              </button>
            </div>
          ) : !board ? (
            <section className="welcome-card">
              <div className="welcome-ball">
                <Basket size={80} />
              </div>
              <span className="eyebrow">A EQUIPA COMEÇA CONTIGO</span>
              <h2>Do WhatsApp para o campo.</h2>
              <p>
                Um só lugar para combinar jogos, marcar presenças e manter as
                contas em dia.
              </p>
              {!email ? (
                <button
                  className="button primary"
                  onClick={() => setModal('login')}
                >
                  <ShieldCheck size={18} />
                  Entrar e criar o meu grupo
                </button>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    const f = new FormData(e.currentTarget)
                    void action(async () => {
                      const result = await api.createGroup(
                        String(f.get('group')),
                        String(f.get('name')),
                      )
                      const who = {
                        playerId: result.player_id,
                        token: result.token,
                      }
                      saveLocal(`scalitpus.identity.${result.invite_code}`, who)
                      setIdentity(who)
                      setCode(result.invite_code)
                      history.replaceState(
                        {},
                        '',
                        `?g=${encodeURIComponent(result.invite_code)}`,
                      )
                    }, 'Grupo criado! Vamos ao primeiro jogo.')
                  }}
                >
                  <Field label="Nome do grupo">
                    <input
                      name="group"
                      required
                      maxLength={60}
                      placeholder="Ex.: Scalitpus"
                    />
                  </Field>
                  <Field label="O teu nome">
                    <input
                      name="name"
                      required
                      maxLength={60}
                      autoComplete="name"
                    />
                  </Field>
                  <button className="button primary" disabled={busy}>
                    Criar grupo
                  </button>
                </form>
              )}
            </section>
          ) : (
            <>
              {page === 'overview' && <ParticipationReport board={board} />}
              {page === 'payments' ? (
                admin ? (
                  <PaymentsPage
                    board={board}
                    busy={busy}
                    initialPlayer=""
                    onRecord={savePayment}
                    onVoid={cancelPayment}
                    onRecordExpense={saveExpense}
                    onVoidExpense={cancelExpense}
                  />
                ) : (
                  <div className="empty-card">
                    <ShieldCheck />
                    <h2>Acesso reservado à administração</h2>
                  </div>
                )
              ) : page === 'games' ? (
                openGameId && board.games.some((g) => g.id === openGameId) ? (
                  <GameDetails
                    key={openGameId}
                    board={board}
                    game={board.games.find((g) => g.id === openGameId)!}
                    identity={identity}
                    admin={admin}
                    busy={busy}
                    onBack={() => setOpenGameId(null)}
                    onRespond={respond}
                    onAttendance={attendance}
                  />
                ) : (
                  <section className="games-grid">
                    {games.length ? (
                      games.map((g) => {
                        const s = gameStats(board, g)
                        const past = new Date(g.starts_at) < new Date()
                        return (
                          <button
                            className="game-list-card"
                            aria-label={`Abrir inscrições: ${readableDate(g.starts_at)} às ${time(g.starts_at)} — ${g.location}`}
                            key={g.id}
                            onClick={() => {
                              setSelectedGameId(g.id)
                              setOpenGameId(g.id)
                            }}
                          >
                            <div className="game-list-top">
                              <span
                                className={`pill ${past ? 'neutral' : 'green'}`}
                              >
                                {past ? 'Terminado' : 'Inscrições abertas'}
                              </span>
                              <ArrowUpRight size={19} />
                            </div>
                            <div className="game-list-date">
                              <span>
                                {formatDate(g.starts_at, { day: '2-digit' })}
                              </span>
                              <div>
                                {formatDate(g.starts_at, {
                                  month: 'long',
                                  year: 'numeric',
                                })}
                                <strong>
                                  {formatDate(g.starts_at, { weekday: 'long' })}{' '}
                                  · {time(g.starts_at)}
                                </strong>
                              </div>
                            </div>
                            <p>
                              <MapPin size={15} />
                              {g.location}
                            </p>
                            <div className="game-list-footer">
                              <span>
                                <Users size={16} />
                                {s.attending.length}/{g.capacity} jogadores
                              </span>
                              <span>
                                Inscrições do jogo <ArrowRight size={15} />
                              </span>
                            </div>
                          </button>
                        )
                      })
                    ) : (
                      <div className="empty-card">
                        <CalendarDays />
                        <h2>Ainda não há jogos</h2>
                        <p>O administrador pode criar o primeiro.</p>
                      </div>
                    )}
                  </section>
                )
              ) : (
                <>
                  <section className="details-grid">
                    <ParticipationGrid
                      board={board}
                      admin={admin}
                      mergeAllowed={mergeAllowed}
                      identity={identity}
                      busy={busy}
                      demo={demo}
                      syncError={syncError}
                      activeGameId={game?.id}
                      onAttendance={attendance}
                      onMerge={() => setModal('merge')}
                      onAdd={() => setModal('player')}
                      onAccess={(playerId) => {
                        void playerAccess(playerId)
                      }}
                    />
                    <aside className="right-column">
                      <div className="note-card">
                        <div className="note-heading">
                          <span className="note-icon">
                            <MessageCircle size={17} />
                          </span>
                          <h3>Recado do balneário</h3>
                          <span className="note-pin" />
                        </div>
                        <p>
                          {game?.note ||
                            'Junta a equipa e traz a boa disposição. Vemo-nos em campo!'}
                        </p>
                        <div className="note-author">
                          <span className="tiny-basket">
                            <Basket size={15} />
                          </span>
                          <span>A administração do grupo</span>
                        </div>
                      </div>
                      <div className="group-summary">
                        <div className="summary-heading">
                          <h3>É mais do que basket.</h3>
                          <Basket size={23} />
                        </div>
                        <p>
                          É o jogo da semana.
                          <br />E a malta que não falha.
                        </p>
                        <div className="summary-line">
                          <span>
                            <CalendarDays size={15} />
                            Jogos marcados
                          </span>
                          <strong>{board.games.length}</strong>
                        </div>
                        <div className="summary-line">
                          <span>
                            <CheckCheck size={15} />
                            Presenças registadas
                          </span>
                          <strong>
                            {
                              board.entries.filter((e) => e.status === 'yes')
                                .length
                            }
                          </strong>
                        </div>
                        <div className="summary-footer">
                          <span className="heart">♡</span> Feito para jogar em
                          equipa.
                        </div>
                      </div>
                      <button
                        className="whatsapp-card"
                        onClick={() => {
                          setSharedPersonalLink('')
                          setModal('share')
                        }}
                      >
                        <span>
                          <MessageCircle size={21} />
                        </span>
                        <div>
                          <strong>O grupo já está no WhatsApp?</strong>
                          <small>Partilha o link. Está feito.</small>
                        </div>
                        <ArrowUpRight size={18} />
                      </button>
                    </aside>
                  </section>
                  {page === 'overview' && (
                    <>
                      {game ? (
                        <section className="overview-grid">
                          <div className="next-game-card">
                            <div className="court-art" aria-hidden="true">
                              <div className="court-boundary">
                                <div className="court-center" />
                                <div className="court-key" />
                                <div className="court-arc" />
                                <div className="court-hoop" />
                              </div>
                              <div className="court-ball">
                                <Basket size={70} />
                              </div>
                            </div>
                            <div className="game-card-content">
                              <div className="game-card-top">
                                <span className="dark-kicker">
                                  <span />
                                  {new Date(game.starts_at) < new Date()
                                    ? 'JOGO ANTERIOR'
                                    : 'PRÓXIMO JOGO'}
                                </span>
                                <span className="open-badge">
                                  {new Date(game.starts_at) < new Date()
                                    ? 'Terminado'
                                    : 'Inscrições abertas'}
                                </span>
                              </div>
                              <h2>{readableDate(game.starts_at)}</h2>
                              <div className="game-meta">
                                <span>
                                  <Clock3 size={16} />
                                  {time(game.starts_at)} –{' '}
                                  {time(
                                    new Date(
                                      new Date(game.starts_at).getTime() +
                                        90 * 60_000,
                                    ).toISOString(),
                                  )}
                                </span>
                                <span>
                                  <MapPin size={16} />
                                  {game.location}
                                </span>
                              </div>
                              <div className="game-card-divider" />
                              <div className="game-card-bottom">
                                <div className="game-people">
                                  <div className="avatar-stack">
                                    {stats?.attending
                                      .slice(0, 4)
                                      .map((p, i) => (
                                        <Avatar
                                          key={p.id}
                                          name={p.name}
                                          index={i}
                                          small
                                        />
                                      ))}
                                    {stats && stats.attending.length > 4 && (
                                      <span className="avatar small stack-extra">
                                        +{stats.attending.length - 4}
                                      </span>
                                    )}
                                  </div>
                                  <span>
                                    <strong>
                                      {stats?.attending.length} confirmados
                                    </strong>{' '}
                                    de {game.capacity} lugares
                                  </span>
                                </div>
                                <span className="game-price">
                                  <Basket size={22} />
                                </span>
                              </div>
                              <div className="capacity-track">
                                <span
                                  style={{
                                    width: `${Math.min(100, ((stats?.attending.length || 0) / game.capacity) * 100)}%`,
                                  }}
                                />
                              </div>
                              <div className="game-card-last">
                                <span>
                                  {(stats?.attending.length || 0) >=
                                  game.capacity
                                    ? 'Equipa completa. Que venha o jogo!'
                                    : `${game.capacity - (stats?.attending.length || 0)} lugares à tua espera`}
                                </span>
                                <span>Externos não pagam</span>
                              </div>
                            </div>
                          </div>
                          <div className="rsvp-card">
                            <div className="rsvp-top">
                              <div className="section-icon">
                                <CheckCheck size={21} />
                              </div>
                              <span>A MINHA PRESENÇA</span>
                            </div>
                            <h3>
                              {myStatus === 'yes'
                                ? 'Estás na equipa!'
                                : myStatus === 'no'
                                  ? 'Fica para a próxima?'
                                  : 'Contamos contigo?'}
                            </h3>
                            <p>
                              {myStatus === 'yes'
                                ? 'Sapatilhas prontas. A equipa conta contigo.'
                                : myStatus === 'no'
                                  ? 'Se os planos mudarem, ainda podes voltar a marcar.'
                                  : 'A tua resposta ajuda a organizar um bom jogo.'}
                            </p>
                            <button
                              className={`button ${myStatus === 'yes' ? 'confirmed' : 'primary'} full`}
                              disabled={
                                busy || new Date(game.starts_at) < new Date()
                              }
                              onClick={() => respond('yes')}
                            >
                              <Check size={18} />
                              {myStatus === 'yes'
                                ? 'Presença confirmada'
                                : 'Sim, vou jogar'}
                            </button>
                            <button
                              className={`rsvp-no ${myStatus === 'no' ? 'selected' : ''}`}
                              disabled={
                                busy || new Date(game.starts_at) < new Date()
                              }
                              onClick={() => respond('no')}
                            >
                              {myStatus === 'no'
                                ? 'Não vou a este jogo'
                                : 'Desta vez não consigo'}
                            </button>
                            <div className="rsvp-foot">
                              <ShieldCheck size={13} />
                              Podes alterar a resposta até ao jogo.
                            </div>
                          </div>
                        </section>
                      ) : (
                        <div className="empty-card">
                          <CalendarDays size={32} />
                          <h2>Vamos marcar um jogo?</h2>
                          <p>
                            {admin
                              ? 'Cria o primeiro e partilha o link com a equipa.'
                              : 'O administrador ainda não marcou o próximo jogo.'}
                          </p>
                          {admin && (
                            <button
                              className="button primary"
                              onClick={() => setModal('game')}
                            >
                              <Plus size={17} />
                              Criar primeiro jogo
                            </button>
                          )}
                        </div>
                      )}
                      <section className="stats-grid">
                        <div className="stat-card">
                          <div className="stat-icon orange">
                            <Users size={21} />
                          </div>
                          <div>
                            <span>Jogadores no grupo</span>
                            <strong>
                              {board.players.filter((p) => !p.external).length}
                              <small>
                                +{' '}
                                {board.players.filter((p) => p.external).length}{' '}
                                externos
                              </small>
                            </strong>
                          </div>
                          <span className="stat-detail">A nossa equipa</span>
                        </div>
                        <div className="stat-card">
                          <div className="stat-icon green">
                            <CheckCheck size={21} />
                          </div>
                          <div>
                            <span>Presenças confirmadas</span>
                            <strong>
                              {stats?.attending.length || 0}
                              <small>/ {game?.capacity || 0}</small>
                            </strong>
                          </div>
                          <span className="stat-detail positive">
                            {stats?.pending.length || 0} por responder
                          </span>
                        </div>
                        <div className="stat-card">
                          <div className="stat-icon blue">
                            <Wallet size={21} />
                          </div>
                          <div>
                            <span>Jogos no calendário</span>
                            <strong>{board.games.length}</strong>
                          </div>
                          <span className="stat-detail">
                            Histórico de participações
                          </span>
                        </div>
                        <div className="stat-card">
                          <div className="stat-icon yellow">
                            <UserPlus size={21} />
                          </div>
                          <div>
                            <span>Externos convidados</span>
                            <strong>
                              {board.players.filter((p) => p.external).length}
                            </strong>
                          </div>
                          <span className="stat-detail">Amigos da equipa</span>
                        </div>
                      </section>
                    </>
                  )}
                </>
              )}
              <footer className="page-footer">
                <span>
                  scalipus<span>.</span> <small>Menos gestão. Mais jogo.</small>
                </span>
                <span>
                  Feito para a nossa equipa <Basket size={13} />
                </span>
              </footer>
            </>
          )}
        </main>
      </div>

      {modal && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModal(null)
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            className="modal"
          >
            <button
              className="modal-close icon-button"
              aria-label="Fechar janela"
              onClick={() => setModal(null)}
            >
              <X size={21} />
            </button>
            {modal === 'merge' && mergeAllowed && board && (
              <MergeForm board={board} busy={busy} onMerge={merge} />
            )}
            {modal === 'game' && admin && (
              <>
                <div className="modal-icon">
                  <CalendarDays size={25} />
                </div>
                <h2 id="modal-title">Vamos marcar um jogo.</h2>
                <p className="modal-intro">
                  Escolhe o campo e a hora. A equipa trata do resto.
                </p>
                <form onSubmit={submitGame}>
                  <Field label="Quando jogamos?">
                    <input
                      name="date"
                      type="datetime-local"
                      required
                      min={new Date(
                        Date.now() - new Date().getTimezoneOffset() * 60_000,
                      )
                        .toISOString()
                        .slice(0, 16)}
                      defaultValue={
                        upcoming[0]
                          ? new Date(
                              new Date(upcoming[0].starts_at).getTime() -
                                new Date(
                                  upcoming[0].starts_at,
                                ).getTimezoneOffset() *
                                  60_000,
                            )
                              .toISOString()
                              .slice(0, 16)
                          : ''
                      }
                    />
                  </Field>
                  <Field label="Local">
                    <input
                      name="location"
                      required
                      maxLength={120}
                      placeholder="Ex.: Pavilhão Municipal"
                      defaultValue={game?.location || ''}
                    />
                  </Field>
                  <div className="form-row">
                    <Field label="Lugares disponíveis">
                      <input
                        name="capacity"
                        type="number"
                        required
                        min={2}
                        max={100}
                        defaultValue={14}
                      />
                    </Field>
                  </div>
                  <Field label="Recado para a equipa (opcional)">
                    <textarea
                      name="note"
                      maxLength={500}
                      placeholder="O que é que a malta precisa de saber?"
                      rows={3}
                    />
                  </Field>
                  <div className="form-tip">
                    <CircleHelp size={15} />
                    Os jogadores externos ficam isentos de pagamento.
                  </div>
                  <button className="button primary full" disabled={busy}>
                    {busy ? (
                      <LoaderCircle className="spin" size={17} />
                    ) : (
                      <Plus size={17} />
                    )}
                    Criar jogo
                  </button>
                </form>
              </>
            )}
            {((modal === 'player' && admin) || modal === 'join') && (
              <>
                <div className="modal-icon">
                  <UserPlus size={25} />
                </div>
                <h2 id="modal-title">
                  {modal === 'join'
                    ? 'Entra na equipa.'
                    : 'Mais um para o jogo.'}
                </h2>
                <p className="modal-intro">
                  {modal === 'join'
                    ? 'Só precisamos do teu nome. O teu acesso fica guardado neste dispositivo.'
                    : 'Adiciona um membro ou um amigo da equipa.'}
                </p>
                <form onSubmit={(e) => submitPlayer(e, modal === 'join')}>
                  <Field label="Nome do jogador">
                    <input
                      name="name"
                      required
                      maxLength={60}
                      minLength={2}
                      autoComplete="name"
                      placeholder="Nome e apelido"
                    />
                  </Field>
                  {modal === 'player' && (
                    <>
                      <label className="checkbox-field">
                        <input type="checkbox" name="external" />
                        <span>
                          <strong>Jogador externo</strong>
                          <small>
                            Amigo de um membro. Isento de pagamento.
                          </small>
                        </span>
                      </label>
                      <Field label="Convidado por (opcional)">
                        <select name="invitedBy">
                          <option value="">Selecionar membro</option>
                          {board?.players
                            .filter((p) => !p.external)
                            .map((p) => (
                              <option key={p.id}>{p.name}</option>
                            ))}
                        </select>
                      </Field>
                    </>
                  )}
                  <button className="button primary full" disabled={busy}>
                    {busy ? (
                      <LoaderCircle className="spin" size={17} />
                    ) : (
                      <Check size={17} />
                    )}{' '}
                    {modal === 'join'
                      ? joiningResponse === 'yes'
                        ? 'Entrar e confirmar presença'
                        : 'Entrar e guardar resposta'
                      : 'Adicionar jogador'}
                  </button>
                </form>
              </>
            )}
            {modal === 'share' && (
              <>
                <div className="modal-icon green">
                  <MessageCircle size={25} />
                </div>
                <h2 id="modal-title">
                  {sharedPersonalLink
                    ? 'O acesso pessoal está pronto.'
                    : 'Leva a equipa para o campo.'}
                </h2>
                <p className="modal-intro">
                  {sharedPersonalLink
                    ? 'Envia este link apenas a este jogador. Permite-lhe marcar a própria presença. Um novo acesso substitui o anterior.'
                    : 'Partilha no grupo do WhatsApp. Cada jogador pode entrar e marcar a sua presença.'}
                </p>
                {demo && (
                  <div className="form-tip demo-share">
                    <Sparkles size={17} />
                    Este link abre a demonstração. As alterações não são
                    partilhadas entre dispositivos.
                  </div>
                )}
                <Field
                  label={
                    sharedPersonalLink
                      ? 'Link pessoal do jogador'
                      : 'Link do grupo'
                  }
                >
                  <div className="copy-input">
                    <input
                      aria-label="Link para partilhar"
                      value={sharedPersonalLink || shareLink}
                      readOnly
                      onFocus={(e) => e.target.select()}
                    />
                    <button
                      aria-label="Copiar link"
                      className="icon-button"
                      onClick={() => void copy(sharedPersonalLink || shareLink)}
                    >
                      <Copy size={18} />
                    </button>
                  </div>
                </Field>
                <a
                  className="button whatsapp full"
                  href={`https://wa.me/?text=${encodeURIComponent(sharedPersonalLink ? `🏀 Este é o teu acesso pessoal ao ${board?.group.name}. Guarda-o para marcar presenças: ${sharedPersonalLink}` : shareText)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle size={18} />
                  Partilhar no WhatsApp <ExternalLink size={15} />
                </a>
                <button
                  className="button secondary full"
                  onClick={() => void copy(sharedPersonalLink || shareLink)}
                >
                  <Link2 size={17} />
                  Copiar link
                </button>
              </>
            )}
            {modal === 'login' && (
              <>
                <div className="modal-icon">
                  <ShieldCheck size={25} />
                </div>
                <h2 id="modal-title">O teu lugar no banco técnico.</h2>
                <p className="modal-intro">
                  Entra com o teu email. Enviamos um link seguro, sem
                  palavras-passe.
                </p>
                {demo ? (
                  <div className="form-tip demo-share">
                    Na demonstração já tens acesso às funções de administrador.
                    Para usar com a tua equipa, o responsável pelo site deve
                    ativar o serviço partilhado.
                  </div>
                ) : (
                  <form onSubmit={login}>
                    <Field label="Email do administrador">
                      <input
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        placeholder="tu@exemplo.pt"
                      />
                    </Field>
                    <button className="button primary full" disabled={busy}>
                      {busy ? (
                        <LoaderCircle className="spin" size={18} />
                      ) : (
                        <ArrowRight size={18} />
                      )}
                      Enviar link de acesso
                    </button>
                  </form>
                )}
              </>
            )}
            {modal === 'settings' && admin && (
              <>
                <div className="modal-icon">
                  <Settings2 size={25} />
                </div>
                <h2 id="modal-title">O banco técnico.</h2>
                <p className="modal-intro">
                  {demo
                    ? `Estás a testar o nível ${role === 'master' ? 'Master' : 'Administrador'}.`
                    : `Sessão iniciada como ${email || 'administrador'}.`}
                </p>
                <div className="settings-summary">
                  <strong>{board?.group.name}</strong>
                  <span>
                    {board?.players.length} jogadores · {board?.games.length}{' '}
                    jogos
                  </span>
                </div>
                {role === 'master' && board && (
                  <StaffPanel
                    board={board}
                    busy={busy}
                    onChange={changeAdmin}
                    onGrantMerge={grantMerge}
                  />
                )}
                {demo ? (
                  <button
                    className="button secondary full"
                    onClick={() => {
                      const fresh = createDemo()
                      setBoard(fresh)
                      setIdentity({ playerId: 'p1', token: 'demo' })
                      setSelectedGameId(null)
                      setModal(null)
                      notify('Demonstração reposta.')
                    }}
                  >
                    Repor dados de demonstração
                  </button>
                ) : (
                  <button
                    className="button secondary full"
                    onClick={() =>
                      void action(
                        async () => {
                          await supabase!.auth.signOut()
                          setRole('user')
                          setPage('overview')
                          if (board)
                            setBoard({
                              ...board,
                              role: 'user',
                              payments: undefined,
                              expenses: undefined,
                              staff: undefined,
                              players: board.players.map(
                                ({ paid_total_cents: _amount, ...p }) => p,
                              ),
                            })
                          setEmail('')
                        },
                        'Sessão terminada.',
                        true,
                      )
                    }
                  >
                    <LogOut size={16} />
                    Terminar sessão de administrador
                  </button>
                )}
              </>
            )}
            {modal === 'help' && (
              <>
                <div className="modal-icon">
                  <Basket size={27} />
                </div>
                <h2 id="modal-title">Menos mensagens. Mais jogo.</h2>
                <p className="modal-intro">
                  O balneário digital do teu grupo de basket.
                </p>
                <div className="help-step">
                  <span>01</span>
                  <div>
                    <h3>Combina o próximo jogo</h3>
                    <p>
                      Um administrador define a data, o local e os lugares
                      disponíveis.
                    </p>
                  </div>
                </div>
                <div className="help-step">
                  <span>02</span>
                  <div>
                    <h3>Partilha no WhatsApp</h3>
                    <p>
                      Envia o link ao grupo. Cada jogador entra com o seu nome e
                      confirma a presença. O administrador também pode responder
                      por ele.
                    </p>
                  </div>
                </div>
                <div className="help-step">
                  <span>03</span>
                  <div>
                    <h3>Contas simples</h3>
                    <p>
                      Os administradores guardam o total pago de cada jogador.
                      Cada data tem a sua coluna de presenças. Os convidados
                      externos ficam isentos.
                    </p>
                  </div>
                </div>
                <div className="form-tip">
                  <Plus size={17} />
                  No telemóvel, abre o menu do navegador e escolhe “Adicionar ao
                  ecrã principal” para teres o Scalitpus à mão.
                </div>
                <button
                  className="button primary full"
                  onClick={() => setModal(null)}
                >
                  Vamos a jogo <ArrowRight size={17} />
                </button>
              </>
            )}
          </section>
        </div>
      )}
      {toast && (
        <div
          role={toast.error ? 'alert' : 'status'}
          className={`toast ${toast.error ? 'error' : ''}`}
        >
          {toast.error ? <CircleHelp size={19} /> : <Check size={19} />}
          <span>{toast.message}</span>
          <button
            className="icon-button"
            aria-label="Fechar aviso"
            onClick={() => setToast(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
