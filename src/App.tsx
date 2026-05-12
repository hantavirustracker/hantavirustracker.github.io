import { useEffect, useMemo, useState } from 'react'
import './App.css'

type Trend = 'rising' | 'steady' | 'easing'
type Severity = 'high' | 'medium' | 'low'

type CountryNode = {
  code: string
  name: string
  x: number
  y: number
  trend: Trend
  mentions: number
  activeAlerts: number
  confirmedCases: number
  lastUpdate: string
}

type Mention = {
  id: string
  country: string
  headline: string
  source: string
  publishedAt: string
  impact: number
  severity: Severity
  summary: string
  link: string
}

type Stats = {
  totalMentions: number
  confirmedCases: number
  activeAlerts: number
  averageImpact: number
}

type BootstrapPayload = {
  countries: CountryNode[]
  mentions: Mention[]
  weeklyMentions: number[]
  stats: Stats
  latestAlert: Mention
}

const fallbackCountries: CountryNode[] = [
  { code: 'US', name: 'United States', x: 20, y: 36, trend: 'rising', mentions: 31, activeAlerts: 4, confirmedCases: 7, lastUpdate: '20:10 UTC' },
  { code: 'CA', name: 'Canada', x: 18, y: 26, trend: 'steady', mentions: 14, activeAlerts: 1, confirmedCases: 2, lastUpdate: '19:30 UTC' },
  { code: 'AR', name: 'Argentina', x: 31, y: 78, trend: 'rising', mentions: 21, activeAlerts: 3, confirmedCases: 5, lastUpdate: '20:25 UTC' },
  { code: 'DE', name: 'Germany', x: 52, y: 31, trend: 'easing', mentions: 9, activeAlerts: 0, confirmedCases: 1, lastUpdate: '18:58 UTC' },
  { code: 'TR', name: 'Turkey', x: 58, y: 35, trend: 'steady', mentions: 11, activeAlerts: 1, confirmedCases: 2, lastUpdate: '19:50 UTC' },
  { code: 'KR', name: 'South Korea', x: 79, y: 34, trend: 'rising', mentions: 18, activeAlerts: 2, confirmedCases: 4, lastUpdate: '20:41 UTC' },
  { code: 'JP', name: 'Japan', x: 84, y: 35, trend: 'steady', mentions: 8, activeAlerts: 0, confirmedCases: 1, lastUpdate: '19:42 UTC' },
  { code: 'PH', name: 'Philippines', x: 81, y: 50, trend: 'rising', mentions: 12, activeAlerts: 1, confirmedCases: 2, lastUpdate: '20:03 UTC' },
  { code: 'ZA', name: 'South Africa', x: 55, y: 80, trend: 'steady', mentions: 7, activeAlerts: 1, confirmedCases: 1, lastUpdate: '18:21 UTC' },
  { code: 'AU', name: 'Australia', x: 86, y: 77, trend: 'easing', mentions: 6, activeAlerts: 0, confirmedCases: 0, lastUpdate: '17:59 UTC' },
]

const fallbackMentions: Mention[] = [
  {
    id: 'm-01',
    country: 'United States',
    headline: 'Clustered respiratory admissions linked to rodent exposure in Four Corners region',
    source: 'Regional Health Dispatch',
    publishedAt: '2026-05-12T19:34:00Z',
    impact: 95,
    severity: 'high',
    summary: 'Emergency departments issued a red advisory after multiple severe cases were reported in a 24-hour window.',
    link: 'https://example.com/mentions/m-01',
  },
  {
    id: 'm-02',
    country: 'Argentina',
    headline: 'Local authorities escalate field surveillance in southern provinces',
    source: 'Andes Public Health Wire',
    publishedAt: '2026-05-12T18:58:00Z',
    impact: 90,
    severity: 'high',
    summary: 'Cross-border surveillance teams increased trap monitoring and clinical screening in high-risk districts.',
    link: 'https://example.com/mentions/m-02',
  },
  {
    id: 'm-03',
    country: 'South Korea',
    headline: 'Mentions spike after two regional hospitals activate enhanced triage protocol',
    source: 'Seoul Daily Bulletin',
    publishedAt: '2026-05-12T18:45:00Z',
    impact: 84,
    severity: 'medium',
    summary: 'Hospitals moved to caution mode and requested accelerated lab reporting for suspected cases.',
    link: 'https://example.com/mentions/m-03',
  },
]

const fallbackData: BootstrapPayload = {
  countries: fallbackCountries,
  mentions: fallbackMentions,
  weeklyMentions: [44, 51, 47, 64, 69, 73, 77],
  stats: {
    totalMentions: fallbackCountries.reduce((sum, country) => sum + country.mentions, 0),
    confirmedCases: fallbackCountries.reduce((sum, country) => sum + country.confirmedCases, 0),
    activeAlerts: fallbackCountries.reduce((sum, country) => sum + country.activeAlerts, 0),
    averageImpact: Math.round(fallbackMentions.reduce((sum, mention) => sum + mention.impact, 0) / fallbackMentions.length),
  },
  latestAlert: fallbackMentions[0],
}

const trendClass: Record<Trend, string> = {
  rising: 'trend trend-rising',
  steady: 'trend trend-steady',
  easing: 'trend trend-easing',
}

function App() {
  const [data, setData] = useState<BootstrapPayload>(fallbackData)
  const [isApiLive, setIsApiLive] = useState(false)
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>(fallbackData.countries[0].code)
  const [selectedMentionId, setSelectedMentionId] = useState<string>(fallbackData.mentions[0].id)

  useEffect(() => {
    const apiBase = import.meta.env.VITE_API_BASE ?? ''
    const fetchBootstrap = async () => {
      try {
        const response = await fetch(`${apiBase}/api/bootstrap`)
        if (!response.ok) {
          throw new Error(`API returned ${response.status}`)
        }

        const payload: BootstrapPayload = await response.json()
        setData(payload)
        setIsApiLive(true)
        setSelectedCountryCode(payload.countries[0]?.code ?? '')
        setSelectedMentionId(payload.mentions[0]?.id ?? '')
      } catch {
        setIsApiLive(false)
      }
    }

    fetchBootstrap()
  }, [])

  const selectedCountry = useMemo(
    () => data.countries.find((country) => country.code === selectedCountryCode) ?? data.countries[0],
    [data.countries, selectedCountryCode],
  )

  const selectedMention = useMemo(
    () => data.mentions.find((mention) => mention.id === selectedMentionId) ?? data.mentions[0],
    [data.mentions, selectedMentionId],
  )

  const latestPopularMentions = data.mentions.slice(0, 6)
  const countrySpecificMentions = data.mentions.filter((mention) => mention.country === selectedCountry?.name)

  if (!selectedCountry || !selectedMention) {
    return null
  }

  return (
    <main className="dashboard">
      <section className="red-alert" aria-live="polite">
        <span className="alert-label">Latest Red Alert</span>
        <p>
          {data.latestAlert.headline} | {data.latestAlert.country} | Impact {data.latestAlert.impact}
        </p>
      </section>

      <header className="header">
        <div>
          <p className="eyebrow">Hantavirus Tracker</p>
          <h1>Interactive Global Map + Popular Mention Intelligence</h1>
          <p className="subtitle">
            Mentions are media and bulletin signals, not confirmed clinical totals. Click countries, pins, and mention cards
            to move through the latest outbreak context.
          </p>
          <p className="api-status">Data mode: {isApiLive ? 'Live Rust API' : 'Fallback snapshot'}</p>
        </div>
      </header>

      <section className="stats-grid" aria-label="Tracker statistics">
        <article>
          <h2>{data.stats.totalMentions}</h2>
          <p>Total mentions</p>
        </article>
        <article>
          <h2>{data.stats.confirmedCases}</h2>
          <p>Confirmed cases</p>
        </article>
        <article>
          <h2>{data.stats.activeAlerts}</h2>
          <p>Active alerts</p>
        </article>
        <article>
          <h2>{data.stats.averageImpact}</h2>
          <p>Average impact score</p>
        </article>
      </section>

      <section className="workspace" aria-label="Map and mention intelligence">
        <div className="map-panel">
          <div className="panel-head">
            <h2>Live Map View</h2>
            <span>{data.countries.length} tracked countries</span>
          </div>

          <div className="map-canvas" role="img" aria-label="World map with country signals">
            {data.countries.map((country) => (
              <button
                key={country.code}
                type="button"
                className={`pin ${selectedCountry.code === country.code ? 'pin-active' : ''}`}
                style={{ left: `${country.x}%`, top: `${country.y}%` }}
                onClick={() => setSelectedCountryCode(country.code)}
                aria-label={`Select ${country.name} ${country.trend} trend`}
              >
                <span className={`pulse ${country.trend}`}></span>
              </button>
            ))}
          </div>

          <div className="country-focus">
            <h3>{selectedCountry.name}</h3>
            <p>
              <span className={trendClass[selectedCountry.trend]}>{selectedCountry.trend}</span>
              <strong>{selectedCountry.mentions}</strong> mentions this week | <strong>{selectedCountry.activeAlerts}</strong>{' '}
              active alerts | Updated {selectedCountry.lastUpdate}
            </p>
          </div>

          <div className="country-list">
            {data.countries.map((country) => (
              <button
                key={country.code}
                type="button"
                className={`country-row ${selectedCountry.code === country.code ? 'country-row-active' : ''}`}
                onClick={() => setSelectedCountryCode(country.code)}
              >
                <span>{country.name}</span>
                <strong>{country.mentions}</strong>
              </button>
            ))}
          </div>
        </div>

        <aside className="mentions-panel">
          <div className="panel-head">
            <h2>Latest 6 Popular Mentions</h2>
            <span>click to inspect</span>
          </div>

          <div className="mentions-list">
            {latestPopularMentions.map((mention) => (
              <button
                key={mention.id}
                type="button"
                className={`mention-card ${selectedMention.id === mention.id ? 'mention-card-active' : ''}`}
                onClick={() => setSelectedMentionId(mention.id)}
              >
                <p className="mention-headline">{mention.headline}</p>
                <p className="mention-meta">
                  {mention.country} | {mention.source}
                </p>
                <p className="mention-score">Impact {mention.impact}</p>
              </button>
            ))}
          </div>

          <article className="mention-detail">
            <h3>{selectedMention.headline}</h3>
            <p>{selectedMention.summary}</p>
            <p className="mention-meta">
              {selectedMention.country} | {selectedMention.source} | {new Date(selectedMention.publishedAt).toLocaleString()}
            </p>
            <a href={selectedMention.link} target="_blank" rel="noreferrer">
              Open source mention
            </a>
          </article>

          <article className="country-mentions">
            <h3>{selectedCountry.name} mention stack</h3>
            {countrySpecificMentions.length > 0 ? (
              <ul>
                {countrySpecificMentions.map((mention) => (
                  <li key={mention.id}>
                    <button type="button" onClick={() => setSelectedMentionId(mention.id)}>
                      {mention.headline}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No mention cards available in current sample feed.</p>
            )}
          </article>

          <article className="donations">
            <h3>Support This Tracker</h3>
            <p>Keep ingestion and incident monitoring running with crypto donations.</p>
            <a href="https://dogechain.info/address/DFLGr4UwumxE8iMonTNBxq4ZCRFSQmbUwX" target="_blank" rel="noreferrer">
              Donate DOGE: DFLGr4UwumxE8iMonTNBxq4ZCRFSQmbUwX
            </a>
            <a href="https://solscan.io/account/EJRnh4xfA8SxcNZSR6hMsoTFPQnHAqA7sxBan19btcbE" target="_blank" rel="noreferrer">
              Donate SOL: EJRnh4xfA8SxcNZSR6hMsoTFPQnHAqA7sxBan19btcbE
            </a>
          </article>
        </aside>
      </section>

      <section className="trend-panel">
        <div className="panel-head">
          <h2>7-day mention trend</h2>
          <span>global signal volume</span>
        </div>
        <div className="bars">
          {data.weeklyMentions.map((value, index) => (
            <div key={value + index} className="bar-col">
              <div className="bar" style={{ height: `${value}%` }}></div>
              <span>D{index + 1}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}

export default App
