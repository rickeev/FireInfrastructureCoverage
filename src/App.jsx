import { useState, useCallback } from 'react'
import Map from './components/Map'
import Header from './components/Header'
import LayerPanel from './components/LayerPanel'
import Sidebar from './components/Sidebar'
import AnalysisPanel from './components/AnalysisPanel'
import LoadingOverlay from './components/LoadingOverlay'
import { useMapData } from './hooks/useMapData'
import { useWorker } from './hooks/useWorker'
import './App.css'

function App() {
  const [selectedFeature, setSelectedFeature] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [analysisPanelOpen, setAnalysisPanelOpen] = useState(false)
  const [activeZipStats, setActiveZipStats] = useState(null)
  const [zipLoading, setZipLoading] = useState(false)

  const {
    hydrants,
    stations,
    addresses,
    zipcodes,
    boundary,
    loading,
    loadingText,
    layerVisibility,
    setLayerVisibility
  } = useMapData()

  const {
    workerReady,
    addressDistancesReady,
    globalSummary,
    requestZipAnalysis
  } = useWorker(hydrants, addresses, stations)

  const handleFeatureClick = useCallback((feature) => {
    if (feature.type === 'zipcode' && workerReady) {
      // Show loading state immediately with partial feature data
      setZipLoading(true)
      setSelectedFeature({ ...feature, stats: null })
      setSidebarOpen(true)

      requestZipAnalysis(feature.geoJsonFeature, (stats) => {
        setSelectedFeature({ ...feature, stats })
        setActiveZipStats(stats)
        setZipLoading(false)
      })
    } else {
      setSelectedFeature(feature)
      setSidebarOpen(true)
    }
  }, [workerReady, requestZipAnalysis])

  const handleCloseSidebar = useCallback(() => {
    setSidebarOpen(false)
    setActiveZipStats(null)
  }, [])

  const toggleLayer = useCallback((layerName) => {
    setLayerVisibility(prev => ({
      ...prev,
      [layerName]: !prev[layerName]
    }))
  }, [setLayerVisibility])

  const hasData = hydrants.length > 0 || stations.length > 0 || addresses.length > 0

  // Use ZIP stats if viewing a ZIP code, otherwise use global counts
  const displayStats = activeZipStats ? {
    hydrantCount: activeZipStats.hydrantCount,
    stationCount: activeZipStats.stationCount || stations.length,
    addressCount: activeZipStats.addressCount,
    ratio: activeZipStats.hydrantCount > 0 && (activeZipStats.stationCount || stations.length) > 0
      ? Math.round(activeZipStats.hydrantCount / (activeZipStats.stationCount || stations.length))
      : '—'
  } : {
    hydrantCount: hydrants.length,
    stationCount: stations.length,
    addressCount: addresses.length,
    ratio: hydrants.length > 0 && stations.length > 0
      ? Math.round(hydrants.length / stations.length)
      : '—'
  }

  return (
    <div className="app">
      <Map
        hydrants={hydrants}
        stations={stations}
        addresses={addresses}
        zipcodes={zipcodes}
        boundary={boundary}
        layerVisibility={layerVisibility}
        onFeatureClick={handleFeatureClick}
      />

      <Header
        hydrantCount={displayStats.hydrantCount}
        stationCount={displayStats.stationCount}
        addressCount={displayStats.addressCount}
        ratio={displayStats.ratio}
        isZipView={!!activeZipStats}
        zipCode={activeZipStats ? selectedFeature?.zipCode : null}
      />

      <LayerPanel
        hydrantCount={hydrants.length}
        stationCount={stations.length}
        addressCount={addresses.length}
        zipcodeCount={zipcodes.length}
        hasBoundary={!!boundary}
        layerVisibility={layerVisibility}
        onToggleLayer={toggleLayer}
      />

      {loading && <LoadingOverlay text={loadingText} />}

      <Sidebar
        isOpen={sidebarOpen}
        feature={selectedFeature}
        onClose={handleCloseSidebar}
      />

      <AnalysisPanel
        isOpen={analysisPanelOpen}
        onClose={() => setAnalysisPanelOpen(false)}
        onOpen={() => setAnalysisPanelOpen(true)}
        hydrantCount={hydrants.length}
        stationCount={stations.length}
        addressCount={addresses.length}
        zipcodeCount={zipcodes.length}
        globalSummary={globalSummary}
        addressDistancesReady={addressDistancesReady}
        hasData={hasData}
      />
    </div>
  )
}

export default App
