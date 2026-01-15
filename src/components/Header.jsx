import './Header.css'

export default function Header({
  hydrantCount,
  stationCount,
  addressCount,
  ratio,
  isZipView,
  zipCode
}) {
  return (
    <header className="header">
      <div className="logo">
        <div className="logo-icon">🔥</div>
        <div className="logo-text">
          <div className="logo-title">Fire Infrastructure Analysis</div>
          <div className="logo-subtitle">Sacramento County</div>
        </div>
      </div>

      <div className="stats-row">
        {isZipView && (
          <div className="zip-indicator">
            <span className="zip-badge">ZIP {zipCode}</span>
          </div>
        )}
        <div className="stat-card">
          <div className="stat-value hydrants">{hydrantCount.toLocaleString() || '—'}</div>
          <div className="stat-label">{isZipView ? 'ZIP Hydrants' : 'Hydrants'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value stations">{stationCount.toLocaleString() || '—'}</div>
          <div className="stat-label">{isZipView ? 'ZIP Stations' : 'Stations'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value addresses">{addressCount.toLocaleString() || '—'}</div>
          <div className="stat-label">{isZipView ? 'ZIP Addresses' : 'Addresses'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value ratio">{ratio}</div>
          <div className="stat-label">H/S Ratio</div>
        </div>
      </div>
    </header>
  )
}
