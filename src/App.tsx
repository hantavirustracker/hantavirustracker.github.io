import { useEffect, useMemo, useRef, useState } from 'react'
import L, { Map as LeafletMap } from 'leaflet'
import { Bar, Line } from 'react-chartjs-2'
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js'
import './App.css'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler)

type CaseStatus = 'CONFIRMED' | 'DECEASED' | 'MONITORING'

type Case = {
  id: string
  caseNumber: number
  status: CaseStatus
  details: string
  location: string
  latitude?: number
  longitude?: number
  country: string
  nationality: string
  dateReported: string
  strain: string
}

type NewsItem = {
  id: string
  title: string
  source: string
  url: string
  publishedAt: string
  country?: string
  summary?: string
}

type DataPayload = {
  lastUpdated: string
  dataSource?: string
  outbreak?: {
    name: string
    strain: string
    originDate: string
    relatedEvent?: string
    exposureMethod?: string
  }
  globalStats: {
    totalConfirmed?: number
    totalExposed?: number
    totalDeaths: number
    totalMonitoring?: number
    affectedCountries: number
    fatalityRate: number
    caseTrend?: string
    totalCases?: number
    suspectedCases?: number
  }
  cases?: Case[]
  monitoring?: Case[]
  outbreaks?: Array<{
    id: string
    country: string
    latitude: number
    longitude: number
    region?: string
    strain?: string
    cases?: number
    deaths?: number
    suspected?: number
    dateReported?: string
    dateUpdated?: string
    severity?: string
    notes?: string
    source?: string
    sourceUrl?: string
  }>
  strains?: Array<{ name: string; region: string; cases: number; deaths?: number; mortality: number }>
  news?: NewsItem[]
  weeklyTrends?: Array<{ week: string; cases: number; deaths: number }>
}

const DOGE_ADDRESS = 'DFLGr4UwumxE8iMonTNBxq4ZCRFSQmbUwX'
const SOL_ADDRESS = 'EJRnh4xfA8SxcNZSR6hMsoTFPQnHAqA7sxBan19btcbE'
const COUNT_API_NAMESPACE = 'hantavirustracker-live'
const TOTAL_VISITS_KEY = 'visits-total'

type CounterResult = {
  value: number
}

const counterDateKey = () => `visits-${new Date().toISOString().slice(0, 10)}`

const getCounter = async (key: string) => {
  const res = await fetch(`https://api.countapi.xyz/get/${COUNT_API_NAMESPACE}/${key}`)
  if (!res.ok) throw new Error('Counter API unavailable')
  const json = (await res.json()) as CounterResult
  return json.value
}

const hitCounter = async (key: string) => {
  const res = await fetch(`https://api.countapi.xyz/hit/${COUNT_API_NAMESPACE}/${key}`)
  if (!res.ok) throw new Error('Counter API unavailable')
  const json = (await res.json()) as CounterResult
  return json.value
}

function App() {
  const [data, setData] = useState<DataPayload | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | CaseStatus>('all')
  const [selected, setSelected] = useState<Case | null>(null)
  const [copyMsg, setCopyMsg] = useState('')
  const [error, setError] = useState('')
  const [visitorCounts, setVisitorCounts] = useState<{ total: number | null; today: number | null }>({
    total: null,
    today: null,
  })
  const [visitorCounterOnline, setVisitorCounterOnline] = useState(false)
  const mapRef = useRef<LeafletMap | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const markersRef = useRef<L.CircleMarker[]>([])

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/data.json', { cache: 'no-store' })
        if (!res.ok) throw new Error('Failed loading live data file')
        const payload: DataPayload = await res.json()
        setData(payload)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error')
      }
    }
    load()
  }, [])

  useEffect(() => {
    const syncVisitorCounters = async () => {
      try {
        const sessionKey = 'hanta-visitor-counted-v1'
        const dayKey = counterDateKey()
        const shouldIncrement = !sessionStorage.getItem(sessionKey)

        const [total, today] = shouldIncrement
          ? await Promise.all([hitCounter(TOTAL_VISITS_KEY), hitCounter(dayKey)])
          : await Promise.all([getCounter(TOTAL_VISITS_KEY), getCounter(dayKey)])

        if (shouldIncrement) {
          sessionStorage.setItem(sessionKey, '1')
        }

        setVisitorCounts({ total, today })
        setVisitorCounterOnline(true)
      } catch {
        setVisitorCounterOnline(false)
      }
    }

    syncVisitorCounters()
  }, [])

  const allCases = useMemo(() => {
    if (!data) return []
    const confirmed = data.cases || []
    const monitoring = data.monitoring || []
    return [...confirmed, ...monitoring]
  }, [data])

  const filteredCases = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allCases.filter((c) => {
      const qMatch =
        q.length === 0 ||
        c.country.toLowerCase().includes(q) ||
        c.location.toLowerCase().includes(q) ||
        c.details.toLowerCase().includes(q)
      const statusMatch = statusFilter === 'all' || c.status === statusFilter
      return qMatch && statusMatch
    })
  }, [allCases, search, statusFilter])

  useEffect(() => {
    if (!mapContainerRef.current || !data) return

    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: true,
      }).setView([15, 0], 2)

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(mapRef.current)
    }

    markersRef.current.forEach((m) => mapRef.current?.removeLayer(m))
    markersRef.current = []

    filteredCases.forEach((c) => {
      // Only add to map if coordinates exist
      if (!c.latitude || !c.longitude) return
      
      const colorMap: Record<CaseStatus, string> = {
        DECEASED: '#ff3b3b',
        CONFIRMED: '#ffa500',
        MONITORING: '#f6ff4d',
      }
      const color = colorMap[c.status]
      
      const marker = L.circleMarker([c.latitude, c.longitude], {
        radius: c.status === 'DECEASED' ? 8 : 6,
        color,
        fillColor: color,
        fillOpacity: 0.8,
        weight: 1,
      })
        .addTo(mapRef.current as LeafletMap)
        .bindPopup(
          `<strong>${c.country}</strong><br><strong>Status:</strong> ${c.status}<br><strong>Location:</strong> ${c.location}<br><strong>Details:</strong> ${c.details.substring(0, 50)}...`,
        )
        .on('click', () => setSelected(c))

      markersRef.current.push(marker)
    })
  }, [data, filteredCases])

  const topAlert = useMemo(() => {
    const deceased = allCases.filter((c) => c.status === 'DECEASED')
    return deceased.length > 0 ? deceased[0] : allCases[0] ?? null
  }, [allCases])

  const latestNews = useMemo(() => (data?.news ?? []).slice(0, 10), [data])

  const timelineLineData = useMemo(() => {
    const trends = data?.weeklyTrends ?? []
    return {
      labels: trends.map((p) => p.week),
      datasets: [
        {
          label: 'Cases',
          data: trends.map((p) => p.cases),
          borderColor: '#30ff90',
          backgroundColor: 'rgba(48,255,144,0.17)',
          fill: true,
          tension: 0.25,
        },
        {
          label: 'Deaths',
          data: trends.map((p) => p.deaths),
          borderColor: '#ff3b3b',
          backgroundColor: 'rgba(255,59,59,0.12)',
          fill: true,
          tension: 0.25,
        },
      ],
    }
  }, [data])

  const caseStatusChart = useMemo(() => {
    const confirmed = allCases.filter((c) => c.status === 'CONFIRMED').length
    const deceased = allCases.filter((c) => c.status === 'DECEASED').length
    const monitoring = allCases.filter((c) => c.status === 'MONITORING').length
    return {
      labels: ['Confirmed', 'Deceased', 'Monitoring'],
      datasets: [
        {
          label: 'Case Status',
          data: [confirmed, deceased, monitoring],
          backgroundColor: ['#ffa500', '#ff3b3b', '#f6ff4d'],
          borderColor: ['#ffaa00', '#ff1a1a', '#ffdd00'],
          borderWidth: 1,
        },
      ],
    }
  }, [allCases])

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        labels: {
          color: '#d2ffea',
        },
      },
    },
    scales: {
      x: {
        ticks: { color: '#98d8bb' },
        grid: { color: 'rgba(38,96,70,0.45)' },
      },
      y: {
        ticks: { color: '#98d8bb' },
        grid: { color: 'rgba(38,96,70,0.45)' },
      },
    },
  }

  const copyAddress = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopyMsg(`${label} address copied`)
      window.setTimeout(() => setCopyMsg(''), 1800)
    } catch {
      setCopyMsg('Copy failed. Clipboard blocked by browser.')
      window.setTimeout(() => setCopyMsg(''), 1800)
    }
  }

  if (error) {
    return <main className="dashboard"><p className="error">Live data error: {error}</p></main>
  }

  if (!data) {
    return <main className="dashboard"><p className="loading">Loading live outbreak matrix...</p></main>
  }

  return (
    <main className="dashboard">
      <header className="hero">
        <p className="tag">🔴 LIVE HANTAVIRUS TRACKER 🔴</p>
        <h1>Global Real-Time Outbreak Monitor</h1>
        <p>
          Real-time case tracking updated every 30 minutes from official health authorities. Track individual cases,
          review case status, and read latest news from major media outlets.
        </p>
        {data?.outbreak && <p style={{ fontSize: '0.85em', marginTop: '0.5em', color: '#00e5ff' }}>
          Current Outbreak: {data.outbreak.name} | {data.outbreak.strain} | {data.outbreak.exposureMethod}
        </p>}
      </header>

      {topAlert && (
        <section className="alert" aria-live="polite">
          ALERT: Case #{topAlert.caseNumber} | Status: {topAlert.status} | {topAlert.country} ({topAlert.location}) | {topAlert.details}
        </section>
      )}

      <section className="stats-grid" aria-label="Global statistics">
        <article><h2>{data?.globalStats.totalConfirmed || data?.globalStats.totalCases || 0}</h2><p>Confirmed Cases</p></article>
        <article><h2>{data?.globalStats.totalDeaths || 0}</h2><p>Deceased</p></article>
        <article><h2>{data?.globalStats.totalMonitoring || 0}</h2><p>Monitoring</p></article>
        <article><h2>{data?.globalStats.totalExposed || 0}</h2><p>Total Exposed</p></article>
        <article><h2>{data?.globalStats.affectedCountries || 0}</h2><p>Affected Countries</p></article>
        <article><h2>{data?.globalStats.fatalityRate || 0}%</h2><p>Fatality Rate</p></article>
      </section>

      <section className="analytics-grid" aria-label="Visitor analytics">
        <article>
          <h2>{visitorCounts.total !== null ? visitorCounts.total.toLocaleString() : '--'}</h2>
          <p>Total Visits</p>
        </article>
        <article>
          <h2>{visitorCounts.today !== null ? visitorCounts.today.toLocaleString() : '--'}</h2>
          <p>Visits Today</p>
        </article>
        <article>
          <h2>{visitorCounterOnline ? 'LIVE' : 'OFFLINE'}</h2>
          <p>Visitor Counter Status</p>
        </article>
      </section>

      <section className="filters">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search country, location, case details"
          aria-label="Search cases"
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | CaseStatus)}>
          <option value="all">All statuses</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="DECEASED">Deceased</option>
          <option value="MONITORING">Monitoring</option>
        </select>
        <span className="updated">Last updated: {data && new Date(data.lastUpdated).toLocaleString()}</span>
      </section>

      <section className="workspace">
        <article className="card">
          <h3>World Outbreak Map</h3>
          <div ref={mapContainerRef} className="map" />
        </article>

        <article className="card">
          <h3>📰 Latest News from Major Media</h3>
          <div className="news-feed">
            {latestNews.length === 0 ? (
              <p style={{color: '#9ccbb3'}}>No news available yet.</p>
            ) : latestNews.map((n) => (
              <a key={n.id} href={n.url} target="_blank" rel="noreferrer" className="news-item">
                <span style={{fontWeight: 600}}>{n.title}</span>
                <small>{n.source} | {new Date(n.publishedAt).toLocaleString()}</small>
                {n.summary && <p style={{fontSize: '0.8em', color: '#8ebea6', marginTop: '0.3em'}}>{n.summary}</p>}
              </a>
            ))}
          </div>
        </article>
      </section>

      <section className="workspace">
        <article className="card">
          <h3>Timeline of Infections</h3>
          <Line data={timelineLineData} options={chartOptions} />
        </article>

        <article className="card">
          <h3>Case Status Breakdown</h3>
          <Bar data={caseStatusChart} options={chartOptions} />
        </article>
      </section>

      <section className="workspace">
        <article className="card">
          <h3>Cases by Status</h3>
          <div className="cases-list">
            {filteredCases.length === 0 ? (
              <p>No cases match your filters.</p>
            ) : (
              filteredCases.map((c) => (
                <div
                  key={c.id}
                  className={`case-item status-${c.status.toLowerCase()}`}
                  onClick={() => setSelected(c)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setSelected(c)}
                >
                  <span className="case-label">#{c.caseNumber} · {c.status}</span>
                  <span className="case-country">{c.country}</span>
                  <span className="case-location">{c.location}</span>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="card">
          <h3>Case Details</h3>
          {selected ? (
            <div className="detail">
              <p><strong>Case #{selected.caseNumber} · {selected.status}</strong></p>
              <p><strong>Location:</strong> {selected.location}, {selected.country}</p>
              <p><strong>Nationality:</strong> {selected.nationality || 'Unknown'}</p>
              <p><strong>Details:</strong> {selected.details}</p>
              <p><strong>Strain:</strong> {selected.strain}</p>
              <p><strong>Reported:</strong> {new Date(selected.dateReported).toLocaleString()}</p>
            </div>
          ) : (
            <p>Click any case to inspect details.</p>
          )}
        </article>
      </section>

      <section className="card donations">
        <h3>Support Tracker Operations</h3>
        <p>Copy wallet addresses to donate. Links removed as requested.</p>
        <div className="copy-actions">
          <button type="button" onClick={() => copyAddress(DOGE_ADDRESS, 'DOGE')}>Copy DOGE Address</button>
          <button type="button" onClick={() => copyAddress(SOL_ADDRESS, 'SOL')}>Copy SOL Address</button>
        </div>
        <p className="wallet">DOGE: {DOGE_ADDRESS}</p>
        <p className="wallet">SOL: {SOL_ADDRESS}</p>
        <p className="copy-msg" aria-live="polite">{copyMsg}</p>
      </section>
    </main>
  )
}

export default App
