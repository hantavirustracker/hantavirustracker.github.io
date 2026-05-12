import React, { useState, useEffect, useMemo, useRef } from 'react';
import L, { Map as LeafletMap } from 'leaflet';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import './App.css';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Analytics tracking (Google Analytics placeholder)
const trackEvent = (eventName: string, eventData?: Record<string, unknown>) => {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', eventName, eventData);
  }
};

interface Outbreak {
  id: string;
  country: string;
  latitude: number;
  longitude: number;
  region: string;
  strain: string;
  cases: number;
  deaths: number;
  suspected: number;
  dateReported: string;
  dateUpdated: string;
  severity: 'high' | 'medium' | 'low';
  notes: string;
  source: string;
  sourceUrl: string;
}

interface GlobalStats {
  totalCases: number;
  totalDeaths: number;
  suspectedCases: number;
  affectedCountries: number;
  fatalityRate: number;
  caseTrend: string;
}

interface DataStructure {
  lastUpdated: string;
  globalStats: GlobalStats;
  outbreaks: Outbreak[];
  weeklyTrends: Array<{ week: string; cases: number; deaths: number }>;
  strains: Array<{ name: string; region: string; cases: number; mortality: number }>;
}

const App: React.FC = () => {
  const [data, setData] = useState<DataStructure | null>(null);
  const [filteredOutbreaks, setFilteredOutbreaks] = useState<Outbreak[]>([]);
  const [selectedOutbreak, setSelectedOutbreak] = useState<Outbreak | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.CircleMarker[]>([]);

  // Load data from data.json
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const response = await fetch('/data.json');
        if (!response.ok) throw new Error('Failed to load data');
        const jsonData: DataStructure = await response.json();
        setData(jsonData);
        trackEvent('data_loaded', { countries: jsonData.globalStats.affectedCountries });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
        trackEvent('data_load_error', { error: String(err) });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Filter outbreaks based on search and severity
  useEffect(() => {
    if (!data) return;

    let filtered = data.outbreaks;

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        o =>
          o.country.toLowerCase().includes(term) ||
          o.strain.toLowerCase().includes(term) ||
          o.region.toLowerCase().includes(term) ||
          o.notes.toLowerCase().includes(term)
      );
      trackEvent('search_performed', { term, results: filtered.length });
    }

    // Apply severity filter
    if (filterSeverity !== 'all') {
      filtered = filtered.filter(o => o.severity === filterSeverity);
    }

    setFilteredOutbreaks(filtered);
  }, [data, searchTerm, filterSeverity]);

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current || !data) return;

    // Initialize map if not already done
    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current).setView([20, 0], 2);

      // Add OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(mapRef.current);
    }

    // Clear existing markers
    markersRef.current.forEach(marker => mapRef.current!.removeLayer(marker));
    markersRef.current = [];

    // Add markers for filtered outbreaks
    filteredOutbreaks.forEach(outbreak => {
      const severityColor =
        outbreak.severity === 'high'
          ? '#ed4a3a'
          : outbreak.severity === 'medium'
            ? '#ff9800'
            : '#4caf50';

      const marker = L.circleMarker([outbreak.latitude, outbreak.longitude], {
        radius: 8,
        fillColor: severityColor,
        color: '#000',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8,
      })
        .addTo(mapRef.current!)
        .bindPopup(`
          <div style="font-family: Space Grotesk; font-size: 12px;">
            <strong>${outbreak.country}</strong><br>
            Cases: ${outbreak.cases} | Deaths: ${outbreak.deaths}<br>
            ${outbreak.region}<br>
            <small>${outbreak.dateUpdated}</small>
          </div>
        `)
        .on('click', () => {
          setSelectedOutbreak(outbreak);
          trackEvent('marker_clicked', { country: outbreak.country });
        });

      markersRef.current.push(marker);
    });
  }, [data, filteredOutbreaks]);

  // Compute statistics (filtered based on search/severity)
  useMemo(() => {
    if (!filteredOutbreaks.length) return null;
    return {
      totalCases: filteredOutbreaks.reduce((sum, o) => sum + o.cases, 0),
      totalDeaths: filteredOutbreaks.reduce((sum, o) => sum + o.deaths, 0),
      totalSuspected: filteredOutbreaks.reduce((sum, o) => sum + o.suspected, 0),
      fatalityRate:
        filteredOutbreaks.reduce((sum, o) => sum + o.cases, 0) > 0
          ? (
              (filteredOutbreaks.reduce((sum, o) => sum + o.deaths, 0) /
                filteredOutbreaks.reduce((sum, o) => sum + o.cases, 0)) *
              100
            ).toFixed(2)
          : 0,
    };
  }, [filteredOutbreaks]);

  // Prepare chart data
  const casesOverTimeChartData = useMemo(() => {
    if (!data?.weeklyTrends) return null;
    return {
      labels: data.weeklyTrends.map(t => t.week),
      datasets: [
        {
          label: 'Cases',
          data: data.weeklyTrends.map(t => t.cases),
          borderColor: '#ed4a3a',
          backgroundColor: 'rgba(237, 74, 58, 0.1)',
          fill: true,
          tension: 0.4,
        },
      ],
    };
  }, [data]);

  const deathsOverTimeChartData = useMemo(() => {
    if (!data?.weeklyTrends) return null;
    return {
      labels: data.weeklyTrends.map(t => t.week),
      datasets: [
        {
          label: 'Deaths',
          data: data.weeklyTrends.map(t => t.deaths),
          borderColor: '#1a1a1a',
          backgroundColor: 'rgba(26, 26, 26, 0.1)',
          fill: true,
          tension: 0.4,
        },
      ],
    };
  }, [data]);

  const casesByCountryChartData = useMemo(() => {
    const topCountries = [...filteredOutbreaks]
      .sort((a, b) => b.cases - a.cases)
      .slice(0, 10);

    return {
      labels: topCountries.map(o => o.country),
      datasets: [
        {
          label: 'Cases by Country (Top 10)',
          data: topCountries.map(o => o.cases),
          backgroundColor: '#ed4a3a',
          borderColor: '#c53a2a',
          borderWidth: 1,
        },
      ],
    };
  }, [filteredOutbreaks]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        display: true,
        labels: {
          font: { family: 'Space Grotesk, sans-serif' },
          color: '#211d18',
        },
      },
    },
    scales: {
      y: {
        ticks: { color: '#5a5349' },
        grid: { color: 'rgba(216, 206, 192, 0.3)' },
      },
      x: {
        ticks: { color: '#5a5349' },
        grid: { color: 'rgba(216, 206, 192, 0.3)' },
      },
    },
  };

  if (loading) {
    return (
      <div className="dashboard">
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <div className="spinner">Loading outbreak data...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard">
        <div style={{ padding: '2rem', color: '#ed4a3a' }}>
          <strong>Error:</strong> {error}
        </div>
      </div>
    );
  }

  const highestSeverityOutbreak = filteredOutbreaks.find(o => o.severity === 'high') ||
    filteredOutbreaks.find(o => o.severity === 'medium') || 
    filteredOutbreaks[0];

  return (
    <div className="dashboard">
      {/* Red Alert Section */}
      {highestSeverityOutbreak && (
        <div
          className="red-alert"
          role="status"
          aria-live="polite"
          aria-label={`Alert: ${highestSeverityOutbreak.cases} cases in ${highestSeverityOutbreak.country}`}
        >
          <div className="alert-content">
            <h3 style={{ margin: 0, color: '#fff' }}>
              🚨 ACTIVE OUTBREAK: {highestSeverityOutbreak.country}
            </h3>
            <p style={{ margin: '0.5rem 0 0 0', color: '#fff' }}>
              {highestSeverityOutbreak.cases} cases | {highestSeverityOutbreak.deaths} deaths |{' '}
              {highestSeverityOutbreak.strain} strain
            </p>
          </div>
        </div>
      )}

      {/* Global Statistics */}
      {data && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{data.globalStats.totalCases}</div>
            <div className="stat-label">Total Cases</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{data.globalStats.totalDeaths}</div>
            <div className="stat-label">Deaths</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{data.globalStats.affectedCountries}</div>
            <div className="stat-label">Countries Affected</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{data.globalStats.fatalityRate}%</div>
            <div className="stat-label">Fatality Rate</div>
          </div>
        </div>
      )}

      {/* Search and Filter Controls */}
      <div className="search-controls">
        <input
          type="text"
          placeholder="Search by country, strain, or region..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="search-input"
          aria-label="Search outbreaks"
        />
        <select
          value={filterSeverity}
          onChange={e => setFilterSeverity(e.target.value as any)}
          className="filter-select"
          aria-label="Filter by severity"
        >
          <option value="all">All Severity Levels</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <div className="result-count">{filteredOutbreaks.length} outbreak(s) found</div>
      </div>

      {/* Main Workspace */}
      <div className="workspace">
        {/* Map Section */}
        <div className="map-panel">
          <h2>Global Outbreak Map</h2>
          <div
            ref={mapContainerRef}
            className="map-container"
            role="img"
            aria-label="Interactive world map showing hantavirus outbreaks"
          />
          <div className="map-legend">
            <div className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: '#ed4a3a' }}></span>
              <span>High Severity</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: '#ff9800' }}></span>
              <span>Medium Severity</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: '#4caf50' }}></span>
              <span>Low Severity</span>
            </div>
          </div>
        </div>

        {/* Details Panel */}
        <div className="details-panel">
          {selectedOutbreak ? (
            <div className="outbreak-detail">
              <button
                className="close-detail"
                onClick={() => setSelectedOutbreak(null)}
                aria-label="Close detail view"
              >
                ✕
              </button>
              <h3>{selectedOutbreak.country}</h3>
              <div className="detail-grid">
                <div>
                  <strong>Cases:</strong> {selectedOutbreak.cases}
                </div>
                <div>
                  <strong>Deaths:</strong> {selectedOutbreak.deaths}
                </div>
                <div>
                  <strong>Suspected:</strong> {selectedOutbreak.suspected}
                </div>
                <div>
                  <strong>Fatality Rate:</strong>{' '}
                  {selectedOutbreak.cases > 0
                    ? ((selectedOutbreak.deaths / selectedOutbreak.cases) * 100).toFixed(1)
                    : 0}
                  %
                </div>
                <div>
                  <strong>Strain:</strong> {selectedOutbreak.strain}
                </div>
                <div>
                  <strong>Severity:</strong>{' '}
                  <span style={{ textTransform: 'capitalize' }}>
                    {selectedOutbreak.severity}
                  </span>
                </div>
                <div>
                  <strong>Region:</strong> {selectedOutbreak.region}
                </div>
                <div>
                  <strong>Updated:</strong> {selectedOutbreak.dateUpdated}
                </div>
              </div>
              <div className="detail-section">
                <strong>Notes:</strong>
                <p>{selectedOutbreak.notes}</p>
              </div>
              <div className="detail-section">
                <a
                  href={selectedOutbreak.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="source-link"
                >
                  View Source ({selectedOutbreak.source})
                </a>
              </div>
            </div>
          ) : (
            <div className="outbreak-list">
              <h3>Recent Outbreaks</h3>
              {filteredOutbreaks.slice(0, 5).map(outbreak => (
                <div
                  key={outbreak.id}
                  className="outbreak-card"
                  onClick={() => {
                    setSelectedOutbreak(outbreak);
                    trackEvent('outbreak_selected', { country: outbreak.country });
                  }}
                  style={{ cursor: 'pointer' }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => {
                    if (e.key === 'Enter') setSelectedOutbreak(outbreak);
                  }}
                >
                  <div className="card-header">
                    <strong>{outbreak.country}</strong>
                    <span
                      className="severity-badge"
                      style={{
                        backgroundColor:
                          outbreak.severity === 'high'
                            ? '#ed4a3a'
                            : outbreak.severity === 'medium'
                              ? '#ff9800'
                              : '#4caf50',
                      }}
                    >
                      {outbreak.severity.toUpperCase()}
                    </span>
                  </div>
                  <div className="card-stats">
                    <span>{outbreak.cases} cases</span>
                    <span>{outbreak.deaths} deaths</span>
                    <span>{outbreak.strain}</span>
                  </div>
                  <p className="card-date">{outbreak.dateUpdated}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Charts Section */}
      <div className="charts-section">
        <h2>Outbreak Trends & Analysis</h2>
        <div className="charts-grid">
          {casesOverTimeChartData && (
            <div className="chart-container">
              <h3>Cases Over Time</h3>
              <Line data={casesOverTimeChartData} options={chartOptions as any} />
            </div>
          )}

          {deathsOverTimeChartData && (
            <div className="chart-container">
              <h3>Deaths Over Time</h3>
              <Line data={deathsOverTimeChartData} options={chartOptions as any} />
            </div>
          )}

          {casesByCountryChartData && (
            <div className="chart-container">
              <h3>Top 10 Affected Countries</h3>
              <Bar data={casesByCountryChartData} options={chartOptions as any} />
            </div>
          )}

          {data?.strains && (
            <div className="chart-container">
              <h3>Strains Overview</h3>
              <div className="strains-list">
                {data.strains.map((strain, idx) => (
                  <div key={idx} className="strain-item">
                    <div className="strain-name">{strain.name}</div>
                    <div className="strain-stats">
                      <span>{strain.cases} cases</span>
                      <span>{strain.mortality}% mortality</span>
                      <span className="strain-region">{strain.region}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Donation Section */}
      <div className="donation-section">
        <h3>Support This Project</h3>
        <div className="donation-buttons">
          <a
            href="https://dogecoin.com"
            target="_blank"
            rel="noopener noreferrer"
            className="donation-link doge"
          >
            💛 Donate DOGE: DFLGr4UwumxE8iMonTNBxq4ZCRFSQmbUwX
          </a>
          <a
            href="https://solana.com"
            target="_blank"
            rel="noopener noreferrer"
            className="donation-link solana"
          >
            ◎ Donate SOL: EJRnh4xfA8SxcNZSR6hMsoTFPQnHAqA7sxBan19btcbE
          </a>
        </div>
      </div>

      {/* Footer */}
      {data && (
        <div className="footer">
          <p>Last updated: {new Date(data.lastUpdated).toLocaleString()}</p>
          <p>Data source: CDC, WHO, ProMED-mail, and national health authorities</p>
        </div>
      )}
    </div>
  );
};

export default App;
