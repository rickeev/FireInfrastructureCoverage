import './Sidebar.css'

function Sidebar({ isOpen, feature, onClose }) {
  if (!feature) return null

  const renderContent = () => {
    switch (feature.type) {
      case 'hydrant':
        return (
          <>
            <div className="sidebar-icon hydrant-icon"><span className="icon-symbol">H</span></div>
            <h2>Fire Hydrant</h2>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">ID</span>
                <span className="detail-value">{feature.id}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Latitude</span>
                <span className="detail-value">{feature.lat?.toFixed(6)}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Longitude</span>
                <span className="detail-value">{feature.lon?.toFixed(6)}</span>
              </div>
            </div>
          </>
        )

      case 'station':
        return (
          <>
            <div className="sidebar-icon station-icon"><span className="icon-symbol">S</span></div>
            <h2>{feature.name}</h2>
            <div className="detail-grid">
              <div className="detail-item full-width">
                <span className="detail-label">Agency</span>
                <span className="detail-value">{feature.agency}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Latitude</span>
                <span className="detail-value">{feature.lat?.toFixed(6)}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Longitude</span>
                <span className="detail-value">{feature.lon?.toFixed(6)}</span>
              </div>
            </div>
            <div className="station-info-note">
              <p>This station serves addresses within a 1-mile response radius. Load address data to see coverage statistics in the ZIP code analysis.</p>
            </div>
          </>
        )

      case 'address':
        return (
          <>
            <div className="sidebar-icon address-icon"><span className="icon-symbol">A</span></div>
            <h2>Address</h2>
            <div className="detail-grid">
              {feature.address && (
                <div className="detail-item full-width">
                  <span className="detail-label">Street</span>
                  <span className="detail-value">{feature.address}</span>
                </div>
              )}
              {feature.city && (
                <div className="detail-item">
                  <span className="detail-label">City</span>
                  <span className="detail-value">{feature.city}</span>
                </div>
              )}
              {feature.zip && (
                <div className="detail-item">
                  <span className="detail-label">ZIP</span>
                  <span className="detail-value">{feature.zip}</span>
                </div>
              )}
            </div>
          </>
        )

      case 'zipcode':
        const stats = feature.stats
        return (
          <>
            <div className="sidebar-icon zipcode-icon"><span className="icon-symbol">Z</span></div>
            <h2>ZIP Code {feature.zipCode}</h2>
            {feature.poName && (
              <p className="zip-city">{feature.poName}</p>
            )}
            {stats ? (
              <div className="zip-stats">
                {/* Area Type Badge */}
                {stats.areaType && (
                  <div className={`area-type-badge ${stats.areaType.toLowerCase()}`}>
                    {stats.areaType} Area
                    {stats.areaSqMiles > 0 && (
                      <span className="area-size">{stats.areaSqMiles.toFixed(1)} sq mi</span>
                    )}
                  </div>
                )}

                {/* Rural Notice */}
                {stats.isRural && stats.ruralNote && (
                  <div className="rural-notice">
                    <span className="rural-icon">i</span>
                    <span>{stats.ruralNote}</span>
                  </div>
                )}

                <div className="stat-row">
                  <span>Fire Stations</span>
                  <span className="stat-num">{stats.stationCount}</span>
                </div>
                <div className="stat-row">
                  <span>Fire Hydrants</span>
                  <span className="stat-num">{stats.hydrantCount.toLocaleString()}</span>
                </div>
                <div className="stat-row">
                  <span>Total Addresses</span>
                  <span className="stat-num">{stats.addressCount.toLocaleString()}</span>
                </div>

                {stats.addressCount > 0 && (
                  <>
                    <div className="stat-divider" />
                    <div className="stat-section-label">Fire Station Response</div>
                    <div className="stat-row highlight-blue">
                      <span>Within 1-mile of station</span>
                      <span className="stat-num">{stats.stationCoveragePercent}%</span>
                    </div>
                    <div className="stat-row">
                      <span>Avg. distance to station</span>
                      <span className="stat-num">{(stats.avgDistanceToStation / 5280).toFixed(2)} mi</span>
                    </div>

                    <div className="stat-divider" />
                    <div className="stat-section-label">Hydrant Proximity</div>
                    {!stats.isRural ? (
                      <>
                        <div className="stat-row highlight">
                          <span>Within 500 ft (optimal)</span>
                          <span className="stat-num">{stats.coveragePercent500}%</span>
                        </div>
                        <div className="stat-row">
                          <span>Within 1,000 ft (acceptable)</span>
                          <span className="stat-num">{stats.coveragePercent1000}%</span>
                        </div>
                        <div className="stat-row danger">
                          <span>Beyond 1,000 ft</span>
                          <span className="stat-num">{stats.addressesUnderserved.toLocaleString()}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="stat-row">
                          <span>Within 500 ft</span>
                          <span className="stat-num">{stats.coveragePercent500}%</span>
                        </div>
                        <div className="stat-row">
                          <span>Within 1,000 ft</span>
                          <span className="stat-num">{stats.coveragePercent1000}%</span>
                        </div>
                        <div className="stat-row muted">
                          <span>Beyond 1,000 ft</span>
                          <span className="stat-num">{stats.addressesUnderserved.toLocaleString()}</span>
                        </div>
                        <p className="rural-hydrant-note">
                          Rural areas typically rely on water tankers and natural water sources rather than hydrant infrastructure.
                        </p>
                      </>
                    )}

                    <div className="stat-divider" />
                    <div className="stat-section-label">Density Metrics</div>
                    <div className="stat-row">
                      <span>Avg. distance to hydrant</span>
                      <span className="stat-num">{Math.round(stats.avgDistanceToHydrant).toLocaleString()} ft</span>
                    </div>
                    <div className="stat-row">
                      <span>Hydrants per 1,000 addresses</span>
                      <span className="stat-num">{stats.hydrantDensity}</span>
                    </div>
                    {stats.addressDensity > 0 && (
                      <div className="stat-row">
                        <span>Addresses per sq mile</span>
                        <span className="stat-num">{Math.round(stats.addressDensity).toLocaleString()}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="loading-stats">
                <div className="loading-spinner" />
                <span>Analyzing ZIP code data...</span>
              </div>
            )}
          </>
        )

      default:
        return <p>Unknown feature type</p>
    }
  }

  return (
    <div className={`sidebar ${isOpen ? 'open' : ''}`}>
      <button className="sidebar-close" onClick={onClose}>×</button>
      <div className="sidebar-content">
        {renderContent()}
      </div>
    </div>
  )
}

export default Sidebar
