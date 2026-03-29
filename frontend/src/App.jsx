import { useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Cpu,
  ListTree,
  LockKeyhole,
  LogOut,
  Radio,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TimerReset,
  Workflow,
} from 'lucide-react'
import { mockData } from './mockData'
import { api } from './api'
import { useMonitorAuth } from './useMonitorAuth'
import { useTelemetrySnapshot } from './useTelemetrySnapshot'

function Panel({ title, subtitle, icon: Icon, children, accent = 'violet' }) {
  return (
    <section className={`panel panel-${accent}`}>
      <div className="panel-head">
        <div>
          <div className="panel-kicker">{subtitle}</div>
          <div className="panel-title-row">
            {Icon ? <Icon size={15} /> : null}
            <h2>{title}</h2>
          </div>
        </div>
      </div>
      {children}
    </section>
  )
}

function Metric({ label, value, hint, tone = 'default' }) {
  return (
    <div className={`metric metric-${tone}`}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-hint">{hint}</div>
    </div>
  )
}

function LoginScreen({ onLogin, error, busy }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  async function submit(event) {
    event.preventDefault()
    await onLogin(username, password)
  }

  return (
    <div className="auth-shell">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />
      <form className="auth-card" onSubmit={submit}>
        <div className="eyebrow">Secure access</div>
        <h1 className="auth-title">OpenClaw Monitor</h1>
        <p className="auth-copy">
          Acceso privado a la telemetría sanitizada del sistema. Sin endpoints públicos y con sesión protegida.
        </p>

        <label className="field">
          <span>Usuario</span>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
        </label>

        <label className="field">
          <span>Contraseña</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>

        {error ? <div className="auth-error">{error}</div> : null}

        <button className="primary-btn auth-btn" disabled={busy}>
          <LockKeyhole size={14} /> {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}

function SessionCard({ item }) {
  return (
    <article className="session-card">
      <div className="session-top">
        <div>
          <div className="session-name">{item.title}</div>
          <div className="session-sub">{item.kind} · {item.model}</div>
        </div>
        <span className={`status-chip ${item.state}`}>
          <Radio size={10} /> {item.state}
        </span>
      </div>
      <p className="session-summary">{item.summary}</p>
      <div className="session-stats">
        <div><Cpu size={12} /> {(item.tokens || 0).toLocaleString()} tokens</div>
        <div><Workflow size={12} /> {item.contextPct || 0}% context</div>
        <div><Clock3 size={12} /> {item.updatedAt}</div>
      </div>
      <div className="usage-bar"><span style={{ width: `${Math.min(item.contextPct || 0, 100)}%` }} /></div>
    </article>
  )
}

function CronCard({ job }) {
  return (
    <article className="cron-card">
      <div className="cron-top">
        <div>
          <div className="cron-name">{job.id}</div>
          <div className="cron-meta">enabled: {String(job.enabled)}</div>
        </div>
        <span className={`status-chip ${job.status}`}>{job.status}</span>
      </div>
      <p className="cron-detail">{job.detail}</p>
      <div className="cron-bottom">
        <span>next · {job.nextRun}</span>
        <span>last · {job.lastRun}</span>
      </div>
    </article>
  )
}

export default function App() {
  const auth = useMonitorAuth()
  const telemetry = useTelemetrySnapshot(Boolean(auth.user))
  const [loginBusy, setLoginBusy] = useState(false)

  const liveData = telemetry.snapshot || mockData
  const overview = liveData.overview || mockData.overview
  const activeWork = liveData.activeWork?.length ? liveData.activeWork : mockData.activeWork
  const cronJobs = liveData.cron?.length ? liveData.cron : mockData.cron
  const timeline = liveData.timeline?.length ? liveData.timeline : mockData.timeline

  const statusLines = useMemo(() => {
    if (!telemetry.snapshot?.statusText) return []
    return telemetry.snapshot.statusText.split('\n').filter(Boolean)
  }, [telemetry.snapshot])

  async function handleLogin(username, password) {
    setLoginBusy(true)
    auth.setError('')
    try {
      await auth.login(username, password)
    } catch (err) {
      auth.setError(err.message || 'login_error')
    } finally {
      setLoginBusy(false)
    }
  }

  async function handleLogout() {
    await auth.logout()
  }

  if (auth.checking) {
    return <div className="loading-state">Comprobando sesión…</div>
  }

  if (!auth.user) {
    return <LoginScreen onLogin={handleLogin} error={auth.error} busy={loginBusy} />
  }

  return (
    <div className="shell">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />

      <header className="topbar">
        <div className="brand-wrap">
          <div className="eyebrow">OpenClaw intelligence layer</div>
          <h1>OpenClaw Monitor</h1>
          <p className="lede">
            Una sala de control pensada para ver sesiones, tareas, subtareas, cron,
            tokens, señales de actividad y logs sin perder contexto.
          </p>
        </div>

        <div className="topbar-side">
          <div className="live-pill">
            <ShieldCheck size={11} /> auth ok · {auth.user.username}
          </div>
          <div className="topbar-actions">
            <button className="ghost-btn small-btn" onClick={telemetry.reload}>
              <RefreshCw size={13} /> refrescar
            </button>
            <button className="ghost-btn small-btn" onClick={handleLogout}>
              <LogOut size={13} /> salir
            </button>
          </div>
          <div className="snapshot-note">api · {api.base}</div>
        </div>
      </header>

      <main className="dashboard-grid">
        <section className="hero panel panel-hero">
          <div className="hero-copy">
            <div className="eyebrow">Observability cockpit</div>
            <h2>
              Mira qué está haciendo OpenClaw <span>ahora mismo</span>
            </h2>
            <p>
              Login real, cookies HttpOnly y telemetría estructurada en progreso. El monitor ya mezcla snapshot segura con datos reales visibles del sistema.
            </p>

            <div className="hero-actions">
              <button className="primary-btn">
                <Sparkles size={14} /> Telemetría real conectada
              </button>
              <button className="ghost-btn">
                Backend privado <ArrowUpRight size={14} />
              </button>
            </div>
          </div>

          <div className="hero-metrics">
            <Metric label="Estado" value={overview.status} hint={overview.runtime || 'backend monitor api'} tone={telemetry.error ? 'warn' : 'ok'} />
            <Metric label="Sesiones activas" value={overview.activeSessions} hint={`Canal ${overview.channel || 'n/a'}`} />
            <Metric label="Tareas activas" value={overview.activeTasks} hint="visible ahora" />
            <Metric label="Errores" value={overview.errors} hint={telemetry.error || 'sin error de API'} tone="warn" />
            <Metric label="Tokens visibles" value={(overview.totalVisibleTokens || 0).toLocaleString()} hint={telemetry.snapshot?.generatedAt ? new Date(telemetry.snapshot.generatedAt).toLocaleTimeString() : 'snapshot local'} />
          </div>
        </section>

        <div className="left-column">
          <Panel title="Trabajo activo" subtitle="Sessions · tasks · live pressure" icon={Activity} accent="violet">
            <div className="stack-list">
              {activeWork.map((item) => <SessionCard key={item.id} item={item} />)}
            </div>
          </Panel>

          <Panel title="Cron jobs" subtitle="Schedulers · delivery · health" icon={TimerReset} accent="emerald">
            <div className="stack-list compact">
              {cronJobs.map((job) => <CronCard key={job.id} job={job} />)}
            </div>
          </Panel>
        </div>

        <div className="right-column">
          <Panel title="Timeline" subtitle="Recent operations" icon={ListTree} accent="amber">
            <div className="timeline-list">
              {timeline.map((event) => (
                <div className="timeline-row" key={event.id}>
                  <div className={`timeline-marker ${event.type}`} />
                  <div className="timeline-body">
                    <div className="timeline-line">{event.text}</div>
                    <div className="timeline-meta">{event.time} <ChevronRight size={11} /> {event.type}</div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel
            title="Snapshot seguro"
            subtitle="Sanitized backend output"
            icon={telemetry.error ? AlertTriangle : CheckCircle2}
            accent={telemetry.error ? 'rose' : 'slate'}
          >
            {telemetry.error ? <div className="auth-error">{telemetry.error}</div> : null}
            <div className="log-stack">
              {statusLines.length === 0 ? (
                <div className="log-line">No snapshot yet.</div>
              ) : (
                statusLines.slice(0, 18).map((line, index) => (
                  <div className="log-line" key={index}>{line}</div>
                ))
              )}
            </div>
          </Panel>
        </div>
      </main>
    </div>
  )
}
