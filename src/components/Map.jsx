import { useEffect, useRef, useMemo } from 'react'
import L from 'leaflet'
import 'leaflet.markercluster'
import './Map.css'

const SACRAMENTO_CENTER = [38.5816, -121.4944]
const DEFAULT_ZOOM = 10

// Convert feet to meters for Leaflet circles
const FEET_TO_METERS = 0.3048
const RADIUS_500FT = 500 * FEET_TO_METERS
const RADIUS_1000FT = 1000 * FEET_TO_METERS

export default function Map({
  hydrants,
  stations,
  addresses,
  zipcodes,
  boundary,
  layerVisibility,
  onFeatureClick
}) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const hydrantClusterRef = useRef(null)
  const hydrantRadiusLayerRef = useRef(null)
  const addressClusterRef = useRef(null)
  const stationLayerRef = useRef(null)
  const zipcodeLayerRef = useRef(null)
  const boundaryLayerRef = useRef(null)
  const boundaryGlowLayerRef = useRef(null)

  // Memoize icons to prevent re-creation
  const hydrantIcon = useMemo(() => L.divIcon({
    className: 'hydrant-marker',
    html: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" fill="#ff4757" stroke="#fff" stroke-width="2"/>
      <text x="12" y="16" text-anchor="middle" fill="white" font-size="11" font-weight="bold">H</text>
    </svg>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  }), [])

  const stationIcon = useMemo(() => L.divIcon({
    className: 'station-marker',
    html: `<div class="station-marker-inner">S</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18]
  }), [])

  const addressIcon = useMemo(() => L.divIcon({
    className: 'address-marker',
    html: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="6" fill="#22c55e" stroke="#fff" stroke-width="1.5"/>
    </svg>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6]
  }), [])

  // Initialize map
  useEffect(() => {
    if (mapInstanceRef.current) return

    mapInstanceRef.current = L.map(mapRef.current, {
      center: SACRAMENTO_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
      preferCanvas: true // Better performance for many markers
    })

    // Create custom panes with specific z-indexes for proper layering
    // Default panes: tile (200), overlay (400), shadow (500), marker (600), tooltip (650), popup (700)
    const map = mapInstanceRef.current

    // Boundary pane - very back (visual only, non-interactive)
    map.createPane('boundaryPane')
    map.getPane('boundaryPane').style.zIndex = 250
    map.getPane('boundaryPane').style.pointerEvents = 'none'

    // Zipcode pane - above boundary, below overlay (where markers are)
    // Visually below markers, but we'll handle clicks via the map click event
    map.createPane('zipcodePane')
    map.getPane('zipcodePane').style.zIndex = 380

    // Radius pane - for hydrant coverage circles (non-interactive)
    map.createPane('radiusPane')
    map.getPane('radiusPane').style.zIndex = 395
    map.getPane('radiusPane').style.pointerEvents = 'none'

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(mapInstanceRef.current)

    L.control.zoom({ position: 'topright' }).addTo(mapInstanceRef.current)

    // Initialize layers
    hydrantClusterRef.current = L.markerClusterGroup({
      chunkedLoading: true,
      chunkInterval: 100,
      chunkDelay: 10,
      maxClusterRadius: 50,
      disableClusteringAtZoom: 17,
      spiderfyOnMaxZoom: true,
      removeOutsideVisibleBounds: true
    })

    hydrantRadiusLayerRef.current = L.featureGroup()

    addressClusterRef.current = L.markerClusterGroup({
      chunkedLoading: true,
      chunkInterval: 100,
      chunkDelay: 10,
      maxClusterRadius: 60,
      disableClusteringAtZoom: 17,
      removeOutsideVisibleBounds: true,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount()
        let size = 'small'
        if (count > 100) size = 'medium'
        if (count > 500) size = 'large'
        return L.divIcon({
          html: `<div><span>${count}</span></div>`,
          className: `marker-cluster marker-cluster-address marker-cluster-${size}`,
          iconSize: L.point(40, 40)
        })
      }
    })

    stationLayerRef.current = L.featureGroup()
    zipcodeLayerRef.current = L.featureGroup()
    boundaryLayerRef.current = L.featureGroup()
    boundaryGlowLayerRef.current = L.featureGroup()

    // Add layers to map in correct order
    mapInstanceRef.current.addLayer(boundaryGlowLayerRef.current)
    mapInstanceRef.current.addLayer(boundaryLayerRef.current)
    mapInstanceRef.current.addLayer(zipcodeLayerRef.current)
    mapInstanceRef.current.addLayer(hydrantRadiusLayerRef.current)
    mapInstanceRef.current.addLayer(addressClusterRef.current)
    mapInstanceRef.current.addLayer(hydrantClusterRef.current)
    mapInstanceRef.current.addLayer(stationLayerRef.current)

    return () => {
      mapInstanceRef.current?.remove()
      mapInstanceRef.current = null
    }
  }, [])

  // Update boundary with glowing effect
  useEffect(() => {
    if (!boundaryLayerRef.current || !boundaryGlowLayerRef.current || !boundary) return

    boundaryLayerRef.current.clearLayers()
    boundaryGlowLayerRef.current.clearLayers()

    // Outer glow layer (multiple layers for glow effect)
    const glowWidths = [16, 12, 8, 5]
    const glowOpacities = [0.1, 0.15, 0.2, 0.25]

    glowWidths.forEach((width, i) => {
      const glowPolygon = L.polygon(boundary, {
        pane: 'boundaryPane',
        color: '#06b6d4',
        weight: width,
        opacity: glowOpacities[i],
        fillColor: 'transparent',
        fillOpacity: 0,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false // Boundary glow should not intercept clicks
      })
      boundaryGlowLayerRef.current.addLayer(glowPolygon)
    })

    // Main boundary line
    const polygon = L.polygon(boundary, {
      pane: 'boundaryPane',
      color: '#06b6d4',
      weight: 3,
      opacity: 1,
      fillColor: '#06b6d4',
      fillOpacity: 0.03,
      className: 'boundary-glow',
      interactive: false // Boundary should not intercept clicks
    })

    polygon.bindTooltip('Sacramento County', {
      permanent: false,
      direction: 'center',
      className: 'boundary-label'
    })

    boundaryLayerRef.current.addLayer(polygon)
    boundaryGlowLayerRef.current.bringToBack()
    boundaryLayerRef.current.bringToBack()

    // Fit to boundary
    const bounds = boundaryLayerRef.current.getBounds()
    if (bounds.isValid()) {
      mapInstanceRef.current?.fitBounds(bounds, { padding: [30, 30] })
    }
  }, [boundary])

  // Update hydrants
  useEffect(() => {
    if (!hydrantClusterRef.current) return

    hydrantClusterRef.current.clearLayers()

    const markers = hydrants.map(h => {
      const marker = L.marker([h.lat, h.lon], { icon: hydrantIcon })
      marker.on('click', () => {
        onFeatureClick({ type: 'hydrant', ...h })
      })
      return marker
    })

    hydrantClusterRef.current.addLayers(markers)

    if (hydrants.length > 0 && !boundary) {
      const bounds = hydrantClusterRef.current.getBounds()
      if (bounds.isValid()) {
        mapInstanceRef.current?.fitBounds(bounds, { padding: [50, 50] })
      }
    }
  }, [hydrants, hydrantIcon, onFeatureClick, boundary])

  // Update hydrant radius circles (only when visible and zoomed in)
  useEffect(() => {
    if (!hydrantRadiusLayerRef.current) return

    hydrantRadiusLayerRef.current.clearLayers()

    if (!layerVisibility.hydrantRadius || hydrants.length === 0) return

    // Only show radius for visible hydrants at higher zoom
    const map = mapInstanceRef.current
    if (!map) return

    const updateRadiusCircles = () => {
      hydrantRadiusLayerRef.current.clearLayers()

      const zoom = map.getZoom()
      if (zoom < 13) return // Only show at higher zoom levels

      const bounds = map.getBounds()
      const visibleHydrants = hydrants.filter(h =>
        bounds.contains([h.lat, h.lon])
      ).slice(0, 500) // Limit for performance

      visibleHydrants.forEach(h => {
        // 500ft radius - green (good coverage)
        const circle500 = L.circle([h.lat, h.lon], {
          pane: 'radiusPane',
          radius: RADIUS_500FT,
          color: '#22c55e',
          weight: 1,
          opacity: 0.6,
          fillColor: '#22c55e',
          fillOpacity: 0.15,
          interactive: false // Radius circles should not intercept clicks
        })

        hydrantRadiusLayerRef.current.addLayer(circle500)
      })
    }

    updateRadiusCircles()
    map.on('moveend zoomend', updateRadiusCircles)

    return () => {
      map.off('moveend zoomend', updateRadiusCircles)
    }
  }, [hydrants, layerVisibility.hydrantRadius])

  // Update stations with response area
  useEffect(() => {
    if (!stationLayerRef.current) return

    stationLayerRef.current.clearLayers()

    stations.forEach(s => {
      // Station response area (1 mile radius)
      const responseCircle = L.circle([s.lat, s.lon], {
        radius: 1609, // 1 mile in meters
        color: '#ffd93d',
        weight: 2,
        opacity: 0.5,
        fillColor: '#ffd93d',
        fillOpacity: 0.08,
        dashArray: '5, 5'
      })
      responseCircle.bindTooltip(`${s.name} - 1 mile response area`, {
        permanent: false,
        direction: 'center'
      })
      stationLayerRef.current.addLayer(responseCircle)

      // Station marker
      const marker = L.marker([s.lat, s.lon], {
        icon: stationIcon,
        zIndexOffset: 1000
      })
      marker.on('click', () => {
        onFeatureClick({ type: 'station', ...s })
      })
      stationLayerRef.current.addLayer(marker)
    })
  }, [stations, stationIcon, onFeatureClick])

  // Update addresses with batched rendering for performance
  useEffect(() => {
    if (!addressClusterRef.current) return

    addressClusterRef.current.clearLayers()

    // For very large datasets, render in batches to prevent UI freeze
    const BATCH_SIZE = 5000
    let currentIndex = 0

    const addBatch = () => {
      const batch = []
      const endIndex = Math.min(currentIndex + BATCH_SIZE, addresses.length)

      for (let i = currentIndex; i < endIndex; i++) {
        const a = addresses[i]
        const marker = L.marker([a.lat, a.lon], { icon: addressIcon })
        marker.on('click', () => {
          onFeatureClick({ type: 'address', ...a })
        })
        batch.push(marker)
      }

      addressClusterRef.current.addLayers(batch)
      currentIndex = endIndex

      // Continue with next batch if more addresses remain
      if (currentIndex < addresses.length) {
        requestAnimationFrame(addBatch)
      }
    }

    if (addresses.length > 0) {
      addBatch()
    }
  }, [addresses, addressIcon, onFeatureClick])

  // Update zipcodes
  useEffect(() => {
    if (!zipcodeLayerRef.current) return

    zipcodeLayerRef.current.clearLayers()

    zipcodes.forEach(z => {
      const geoJsonLayer = L.geoJSON(z.geoJsonFeature, {
        pane: 'zipcodePane',
        style: {
          color: z.color,
          weight: 2,
          opacity: 0.8,
          fillColor: z.color,
          fillOpacity: 0.15
        },
        onEachFeature: (feature, layer) => {
          layer.on('click', (e) => {
            // Stop propagation to prevent other layers from also handling
            L.DomEvent.stopPropagation(e)
            onFeatureClick({ type: 'zipcode', ...z })
          })

          layer.bindTooltip(z.zipCode, {
            permanent: false,
            direction: 'center',
            className: 'zipcode-label'
          })
        }
      })

      zipcodeLayerRef.current.addLayer(geoJsonLayer)
    })
  }, [zipcodes, onFeatureClick])

  // Handle layer visibility
  // Note: Layer z-ordering is handled by custom panes (boundaryPane, zipcodePane, radiusPane)
  // so we don't need to manually reorder layers after toggling
  useEffect(() => {
    if (!mapInstanceRef.current) return

    const map = mapInstanceRef.current

    const toggleLayer = (layer, visible) => {
      if (!layer) return
      if (visible && !map.hasLayer(layer)) {
        map.addLayer(layer)
      } else if (!visible && map.hasLayer(layer)) {
        map.removeLayer(layer)
      }
    }

    toggleLayer(hydrantClusterRef.current, layerVisibility.hydrants)
    toggleLayer(hydrantRadiusLayerRef.current, layerVisibility.hydrantRadius)
    toggleLayer(stationLayerRef.current, layerVisibility.stations)
    toggleLayer(addressClusterRef.current, layerVisibility.addresses)
    toggleLayer(zipcodeLayerRef.current, layerVisibility.zipcodes)
    toggleLayer(boundaryLayerRef.current, layerVisibility.boundary)
    toggleLayer(boundaryGlowLayerRef.current, layerVisibility.boundary)
  }, [layerVisibility])

  return <div ref={mapRef} className="map-container" />
}
