import './App.css'

type CountrySignal = {
  name: string
  trend: 'rising' | 'steady' | 'easing'
  signals: number
  note: string
}

const highlightedCountries: CountrySignal[] = [
  { name: 'Argentina', trend: 'rising', signals: 19, note: 'Southern provinces reporting clustered mentions.' },
  { name: 'Canada', trend: 'steady', signals: 8, note: 'Rural monitoring remains stable this week.' },
  { name: 'Germany', trend: 'easing', signals: 6, note: 'Mentions cooled after early spring activity.' },
  { name: 'South Korea', trend: 'rising', signals: 12, note: 'Urban + regional outlets both increased volume.' },
]

const sourceHealth = [
  { label: 'WHO bulletins', status: 'online' },
  { label: 'Public health APIs', status: 'online' },
  { label: 'Regional news feeds', status: 'degraded' },
  { label: 'Research alerts', status: 'online' },
]

const trendClass: Record<CountrySignal['trend'], string> = {
  rising: 'trend trend-rising',
  steady: 'trend trend-steady',
  easing: 'trend trend-easing',
}

function App() {
  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">Hantavirus Watch Desk</p>
        <h1>Global signal tracker built for fast situational awareness</h1>
        <p className="hero-copy">
          This prototype surfaces mention trends across regions, highlights source health, and keeps caveats obvious.
          Signals represent reported mention activity, not confirmed clinical case counts.
        </p>
        <div className="hero-actions">
          <button type="button">Open live map</button>
          <button type="button" className="ghost">View data sources</button>
        </div>
        <div className="pulse-grid" aria-label="Weekly highlights">
          <article>
            <h2>18</h2>
            <p>active countries</p>
          </article>
          <article>
            <h2>22</h2>
            <p>source channels</p>
          </article>
          <article>
            <h2>12</h2>
            <p>languages ingested</p>
          </article>
        </div>
      </section>

      <section className="board" aria-label="Country signal board">
        <h2>Country Signal Board</h2>
        <div className="cards">
          {highlightedCountries.map((country) => (
            <article key={country.name} className="card">
              <header>
                <h3>{country.name}</h3>
                <span className={trendClass[country.trend]}>{country.trend}</span>
              </header>
              <p className="signal-count">{country.signals} signals / week</p>
              <p>{country.note}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="sources" aria-label="Source status">
        <h2>Source Pipeline Health</h2>
        <ul>
          {sourceHealth.map((source) => (
            <li key={source.label}>
              <span>{source.label}</span>
              <strong className={source.status === 'online' ? 'online' : 'degraded'}>{source.status}</strong>
            </li>
          ))}
        </ul>
      </section>

      <footer className="footnote">
        <p>
          Coverage is still expanding across Asia and Africa. Feedback can help prioritize the next country rollouts.
        </p>
      </footer>
    </main>
  )
}

export default App
