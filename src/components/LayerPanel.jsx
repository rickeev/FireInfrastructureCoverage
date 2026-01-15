import './LayerPanel.css'

function LayerPanel({
  hydrantCount,
  stationCount,
  addressCount,
  zipcodeCount,
  hasBoundary,
  layerVisibility,
  onToggleLayer
}) {
  const layers = [
    { key: 'hydrants', label: 'Hydrants', count: hydrantCount, color: '#ff4757' },
    { key: 'stations', label: 'Stations', count: stationCount, color: '#ffd93d' },
    { key: 'addresses', label: 'Addresses', count: addressCount, color: '#4ade80' },
    { key: 'zipcodes', label: 'ZIP Codes', count: zipcodeCount, color: '#8b5cf6' },
    { key: 'boundary', label: 'County Boundary', count: hasBoundary ? 1 : 0, color: '#06b6d4' }
  ]

  return (
    <div className="layer-panel">
      <div className="layer-panel-header">Layers</div>
      <div className="layer-list">
        {layers.map(layer => (
          <label key={layer.key} className="layer-item" title={layer.hint || ''}>
            <input
              type="checkbox"
              checked={layerVisibility[layer.key]}
              onChange={() => onToggleLayer(layer.key)}
            />
            <span
              className="layer-indicator"
              style={{ backgroundColor: layer.color }}
            />
            <span className="layer-name">{layer.label}</span>
            {layer.count > 0 && (
              <span className="layer-count">{layer.count.toLocaleString()}</span>
            )}
          </label>
        ))}
      </div>
    </div>
  )
}

export default LayerPanel
