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

type Severity = 'high' | 'medium' | 'low'

type Outbreak = {
  id: string
  country: string
  latitude: number
  longitude: number
  region: string
  strain: string
  cases: number
  deaths: number
  suspected: number
  dateReported: string
  dateUpdated: string
  severity: Severity
  notes: string
  source: string
  sourceUrl: string
}

type NewsItem = {
  id: string
  title: string
  source: string
  url: string
  publishedAt: string
  country: string
}

type TimelinePoint = {
  date: string
  cases: number
  deaths: number
  suspected: number
  countriesAffected: number
  spreadScore: number
}

type DataPayload = {
  lastUpdated: string
  globalStats: {
    totalCases: number
    totalDeaths: number
    suspectedCases: number
    affectedCountries: number
    fatalityRate: number
    caseTrend: string
  }
  outbreaks: Outbreak[]
  weeklyTrends: Array<{ week: string; cases: number; deaths: number }>
  strains: Array<{ name: string; region: string; cases: number; mortality: number }>
  news: NewsItem[]
  timeline: TimelinePoint[]
}

const DOGE_ADDRESS = 'DFLGr4UwumxE8iMonTNBxq4ZCRFSQmbUwX'
const SOL_ADDRESS = 'EJRnh4xfA8SxcNZSR6hMsoTFPQnHAqA7sxBan19btcbE'

function App() {
  const [data, setData] = useState<DataPayload | null>(null)
  const [search, setSearch] = useState('')
  const [severity, setSeverity] = useState<'all' | Severity>('all')
  const [selected, setSelected] = useState<Outbreak | null>(null)
  const [copyMsg, setCopyMsg] = useState('')
  const [error, setError] = useState('')
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

  const filteredOutbreaks = useMemo(() => {
    if (!data) return []
    const q = search.trim().toLowerCase()
    return data.outbreaks.filter((item) => {
      const qMatch =
        q.length === 0 ||
        item.country.toLowerCase().includes(q) ||
        item.region.toLowerCase().includes(q) ||
        item.strain.toLowerCase().includes(q) ||
        item.notes.toLowerCase().includes(q)
      const sMatch = severity === 'all' || item.severity === severity
      return qMatch && sMatch
    })
  }, [data, search, severity])

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

    filteredOutbreaks.forEach((o) => {
      const color = o.severity === 'high' ? '#ff3b3b' : o.severity === 'medium' ? '#f6ff4d' : '#30ff90'
      const marker = L.circleMarker([o.latitude, o.longitude], {
        radius: 7,
        color,
        fillColor: color,
        fillOpacity: 0.9,
        weight: 1,
      })
        .addTo(mapRef.current as LeafletMap)
        .bindPopup(
          `<strong>${o.country}</strong><br>${o.region}<br>Cases: ${o.cases} | Deaths: ${o.deaths}<br>${o.dateUpdated}`,
        )
        .on('click', () => setSelected(o))

      markersRef.current.push(marker)
    })
  }, [data, filteredOutbreaks])

  const topAlert = useMemo(() => {
    return filteredOutbreaks.find((x) => x.severity === 'high') ?? filteredOutbreaks[0] ?? null
  }, [filteredOutbreaks])

  const latestNews = useMemo(() => (data?.news ?? []).slice(0, 12), [data])

  const timelineLineData = useMemo(() => {
    const timeline = data?.timeline ?? []
    return {
      labels: timeline.map((p) => p.date),
      datasets: [
        {
          label: 'Cases',
          data: timeline.map((p) => p.cases),
          borderColor: '#30ff90',
          backgroundColor: 'rgba(48,255,144,0.17)',
          fill: true,
          tension: 0.25,
        },
        {
          label: 'Deaths',
          data: timeline.map((p) => p.deaths),
          borderColor: '#ff3b3b',
          backgroundColor: 'rgba(255,59,59,0.12)',
          fill: true,
          tension: 0.25,
        },
      ],
    }
  }, [data])

  const spreadLineData = useMemo(() => {
    const timeline = data?.timeline ?? []
    return {
      labels: timeline.map((p) => p.date),
      datasets: [
        {
          label: 'Spread Score',
          data: timeline.map((p) => p.spreadScore),
          borderColor: '#00e5ff',
          backgroundColor: 'rgba(0,229,255,0.16)',
          fill: true,
          tension: 0.2,
        },
      ],
    }
  }, [data])

  const countryBarData = useMemo(() => {
    const top = [...filteredOutbreaks].sort((a, b) => b.cases - a.cases).slice(0, 12)
    return {
      labels: top.map((x) => x.country),
      datasets: [
        {
          label: 'Cases by Country',
          data: top.map((x) => x.cases),
          borderColor: '#30ff90',
          backgroundColor: 'rgba(48,255,144,0.45)',
          borderWidth: 1,
        },
      ],
    }
  }, [filteredOutbreaks])

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
        <p className="tag">HANTAVIRUS LIVE MATRIX</p>
        <h1>Global Infection Intelligence Grid</h1>
        <p>
          Real-source outbreak signals ingested every 30 minutes. Search countries, review spread timeline,
          and inspect latest reports.
        </p>
      </header>

      {topAlert && (
        <section className="alert" aria-live="polite">
          ALERT: {topAlert.country} | {topAlert.cases} cases | {topAlert.deaths} deaths | Updated {topAlert.dateUpdated}
        </section>
      )}

      <section className="stats-grid" aria-label="Global statistics">
        <article><h2>{data.globalStats.totalCases}</h2><p>Total Cases</p></article>
        <article><h2>{data.globalStats.totalDeaths}</h2><p>Total Deaths</p></article>
        <article><h2>{data.globalStats.suspectedCases}</h2><p>Suspected Cases</p></article>
        <article><h2>{data.globalStats.affectedCountries}</h2><p>Affected Countries</p></article>
        <article><h2>{data.globalStats.fatalityRate}%</h2><p>Fatality Rate</p></article>
        <article><h2>{filteredOutbreaks.length}</h2><p>Matching Outbreaks</p></article>
      </section>

      <section className="filters">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search country, region, strain"
          aria-label="Search outbreaks by country"
        />
        <select value={severity} onChange={(e) => setSeverity(e.target.value as 'all' | Severity)}>
          <option value="all">All severity</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <span className="updated">Last updated: {new Date(data.lastUpdated).toLocaleString()}</span>
      </section>

      <section className="workspace">
        <article className="card">
          <h3>World Outbreak Map</h3>
          <div ref={mapContainerRef} className="map" />
        </article>

        <article className="card">
          <h3>Latest News</h3>
          <div className="news-feed">
            {latestNews.map((n) => (
              <a key={n.id} href={n.url} target="_blank" rel="noreferrer" className="news-item">
                <span>{n.title}</span>
                <small>{n.source} | {new Date(n.publishedAt).toLocaleString()} | {n.country}</small>
              </a>
            ))}
          </div>
        </article>
      </section>

      <section className="workspace">
        <article className="card">
          <h3>Timeline of Infections and Spread</h3>
          <Line data={timelineLineData} options={chartOptions} />
        </article>

        <article className="card">
          <h3>Spread Intensity Timeline</h3>
          <Line data={spreadLineData} options={chartOptions} />
        </article>
      </section>

      <section className="workspace">
        <article className="card">
          <h3>Cases by Country</h3>
          <Bar data={countryBarData} options={chartOptions} />
        </article>

        <article className="card">
          <h3>Selected Outbreak</h3>
          {selected ? (
            <div className="detail">
              <p><strong>{selected.country}</strong> - {selected.region}</p>
              <p>Cases: {selected.cases} | Deaths: {selected.deaths} | Suspected: {selected.suspected}</p>
              <p>Strain: {selected.strain} | Severity: {selected.severity}</p>
              <p>{selected.notes}</p>
              <a href={selected.sourceUrl} target="_blank" rel="noreferrer">Open source report</a>
            </div>
          ) : (
            <p>Click any map marker to inspect details.</p>
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
