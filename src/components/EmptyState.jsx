import { useRef } from 'react'
import './EmptyState.css'

function EmptyState({ onLoadHydrants, onLoadStations, onLoadAddresses }) {
  const hydrantInputRef = useRef(null)
  const stationInputRef = useRef(null)
  const addressInputRef = useRef(null)

  return (
    <div className="empty-state">
      <div className="empty-state-content">
        <div className="empty-icon">🔥</div>
        <h2>Fire Infrastructure Coverage</h2>
        <p>Load your GeoJSON data to visualize fire hydrants, stations, and coverage analysis for Sacramento County.</p>

        <div className="empty-actions">
          <input
            ref={hydrantInputRef}
            type="file"
            accept=".geojson,.json"
            onChange={onLoadHydrants}
            style={{ display: 'none' }}
          />
          <button
            className="empty-btn primary"
            onClick={() => hydrantInputRef.current?.click()}
          >
            <span className="empty-btn-icon hydrant-icon">H</span>
            Load Hydrants
          </button>

          <input
            ref={stationInputRef}
            type="file"
            accept=".geojson,.json"
            onChange={onLoadStations}
            style={{ display: 'none' }}
          />
          <button
            className="empty-btn"
            onClick={() => stationInputRef.current?.click()}
          >
            <span className="empty-btn-icon station-icon">S</span>
            Load Stations
          </button>

          <input
            ref={addressInputRef}
            type="file"
            accept=".csv"
            onChange={onLoadAddresses}
            style={{ display: 'none' }}
          />
          <button
            className="empty-btn"
            onClick={() => addressInputRef.current?.click()}
          >
            <span className="empty-btn-icon address-icon">A</span>
            Load Addresses
          </button>
        </div>

        <div className="empty-hint">
          <p>County boundary and ZIP codes load automatically. Upload hydrants, stations, and addresses to enable coverage analysis.</p>
        </div>
      </div>
    </div>
  )
}

export default EmptyState
