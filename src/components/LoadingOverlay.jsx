import './LoadingOverlay.css'

function LoadingOverlay({ text }) {
  return (
    <div className="loading-overlay">
      <div className="loading-content">
        <div className="loading-spinner">
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
        </div>
        <p className="loading-text">{text || 'Loading...'}</p>
      </div>
    </div>
  )
}

export default LoadingOverlay
