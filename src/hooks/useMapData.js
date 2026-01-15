import { useState, useCallback, useEffect, useRef } from 'react'

// Base URL for data files (relative to public folder or absolute paths)
const DATA_PATHS = {
  boundary: '/data/sacramento_county_boundary.geojson',
  zipcodes: '/data/zipcodes.geojson',
  agencyStats: '/data/agency_stats.csv',
  stationCoverage: '/data/station_coverage.csv'
}

// ZIP code colors (shared between URL and file load functions)
const ZIP_COLORS = [
  '#ec4899', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e', '#06b6d4'
]

// Extract lat/lon from GeoJSON feature (handles Point and Polygon geometries)
const extractCoordinates = (feature) => {
  if (feature.geometry?.type === 'Point') {
    return {
      lat: feature.geometry.coordinates[1],
      lon: feature.geometry.coordinates[0]
    }
  } else if (feature.geometry?.type === 'Polygon') {
    const coords = feature.geometry.coordinates[0]
    return {
      lat: coords.reduce((sum, c) => sum + c[1], 0) / coords.length,
      lon: coords.reduce((sum, c) => sum + c[0], 0) / coords.length
    }
  }
  return { lat: null, lon: null }
}

export function useMapData() {
  const [hydrants, setHydrants] = useState([])
  const [stations, setStations] = useState([])
  const [addresses, setAddresses] = useState([])
  const [zipcodes, setZipcodes] = useState([])
  const [boundary, setBoundary] = useState(null)
  const [agencyStats, setAgencyStats] = useState([])
  const [stationCoverageData, setStationCoverageData] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingText, setLoadingText] = useState('')
  const [initialDataLoaded, setInitialDataLoaded] = useState(false)
  const [layerVisibility, setLayerVisibility] = useState({
    hydrants: true,
    stations: true,
    addresses: true,
    zipcodes: true,
    hydrantRadius: false,
    boundary: true
  })

  // Ref to track maximum progress reported (prevents backwards counting)
  const maxProgressRef = useRef(0)

  // Auto-load all data on mount
  useEffect(() => {
    if (initialDataLoaded) return

    const loadInitialData = async () => {
      setLoading(true)

      try {
        // Phase 1: Load boundary, ZIP codes, and supporting data
        setLoadingText('Loading map boundaries...')
        await Promise.all([
          loadBoundaryFromUrl('/sacramento_county_boundary/CountyBoundary_5104904504067207209.geojson'),
          loadZipcodesFromUrl('/zip_codes/ZipCodes_-2330228906818392563.geojson'),
          loadAgencyStatsFromUrl('/fire_coverage_analysis/agency_stats.csv'),
          loadStationCoverageFromUrl('/fire_coverage_analysis/station_coverage.csv')
        ])

        // Phase 2: Load hydrants
        setLoadingText('Loading fire hydrants...')
        await loadHydrantsFromUrl('/data/sacramento_fire_hydrants.geojson')

        // Phase 3: Load stations
        setLoadingText('Loading fire stations...')
        await loadStationsFromUrl('/data/sacramento_fire_stations.geojson')

        // Phase 4: Load addresses (largest file, load last)
        // Reset progress ref before starting percentage-based loading
        maxProgressRef.current = 0
        setLoadingText('Loading addresses...')
        await loadAddressesFromUrl('/data/addresses_cleaned.csv')

      } catch (err) {
        console.warn('Could not auto-load initial data:', err)
      } finally {
        setLoading(false)
        setInitialDataLoaded(true)
      }
    }

    loadInitialData()
  }, [initialDataLoaded])

  // Load boundary from GeoJSON URL
  const loadBoundaryFromUrl = async (url) => {
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const data = await response.json()
      const feature = data.features?.[0]

      if (feature?.geometry?.type === 'Polygon') {
        // Convert GeoJSON coordinates [lon, lat] to Leaflet [lat, lon]
        const coords = feature.geometry.coordinates[0].map(c => [c[1], c[0]])
        setBoundary(coords)
      }
    } catch (err) {
      console.warn('Could not load boundary:', err)
    }
  }

  // Load ZIP codes from GeoJSON URL
  const loadZipcodesFromUrl = async (url) => {
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const data = await response.json()
      const features = data.features || []

      const zipcodePolygons = features.map((f, i) => {
        const props = f.properties || {}
        return {
          id: i,
          zipCode: props.ZIP5 || props.zip || props.ZIPCODE || 'Unknown',
          poName: props.PO_NAME || props.po_name || props.city || '',
          color: ZIP_COLORS[i % ZIP_COLORS.length],
          geoJsonFeature: f
        }
      })

      setZipcodes(zipcodePolygons)
    } catch (err) {
      console.warn('Could not load ZIP codes:', err)
    }
  }

  // Load agency stats from CSV URL
  const loadAgencyStatsFromUrl = async (url) => {
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const text = await response.text()
      const lines = text.split('\n')
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))

      const stats = []
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i]
        if (!line.trim()) continue

        const values = parseCSVLine(line)
        const getVal = (name) => {
          const idx = headers.indexOf(name)
          return idx !== -1 ? values[idx] : null
        }

        stats.push({
          agency: getVal('agency'),
          stationCount: parseInt(getVal('station_count')) || 0,
          avgNearestDistance: parseFloat(getVal('avg_nearest_distance_ft')) || 0,
          avgHydrantsWithin500: parseFloat(getVal('avg_hydrants_within_500ft')) || 0,
          avgHydrantsWithin1000: parseFloat(getVal('avg_hydrants_within_1000ft')) || 0,
          stationsExcellent: parseInt(getVal('stations_excellent')) || 0,
          stationsGood: parseInt(getVal('stations_good')) || 0,
          stationsNeedsAttention: parseInt(getVal('stations_needs_attention')) || 0
        })
      }

      setAgencyStats(stats)
    } catch (err) {
      console.warn('Could not load agency stats:', err)
    }
  }

  // Load station coverage from CSV URL
  const loadStationCoverageFromUrl = async (url) => {
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const text = await response.text()
      const lines = text.split('\n')
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))

      const coverageData = []
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i]
        if (!line.trim()) continue

        const values = parseCSVLine(line)
        const getVal = (name) => {
          const idx = headers.indexOf(name)
          return idx !== -1 ? values[idx] : null
        }

        coverageData.push({
          stationName: getVal('station_name'),
          agency: getVal('agency'),
          latitude: parseFloat(getVal('latitude')),
          longitude: parseFloat(getVal('longitude')),
          nearestHydrantFt: parseFloat(getVal('nearest_hydrant_ft')),
          hydrantsWithin500: parseInt(getVal('hydrants_within_500ft')) || 0,
          hydrantsWithin1000: parseInt(getVal('hydrants_within_1000ft')) || 0,
          hydrantsWithinQuarterMile: parseInt(getVal('hydrants_within_quarter_mile')) || 0,
          avgDistance10Nearest: parseFloat(getVal('avg_distance_10_nearest_ft')),
          coverageRating: getVal('coverage_rating')
        })
      }

      setStationCoverageData(coverageData)
    } catch (err) {
      console.warn('Could not load station coverage:', err)
    }
  }

  // Helper to parse CSV line with quotes
  const parseCSVLine = (line) => {
    const values = []
    let current = ''
    let inQuotes = false
    for (const c of line) {
      if (c === '"') inQuotes = !inQuotes
      else if (c === ',' && !inQuotes) {
        values.push(current.trim().replace(/"/g, ''))
        current = ''
      } else {
        current += c
      }
    }
    values.push(current.trim().replace(/"/g, ''))
    return values
  }

  // Load hydrants from GeoJSON URL
  const loadHydrantsFromUrl = async (url) => {
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const data = await response.json()
      const features = data.features || []

      const hydrantPoints = features
        .filter(f => f.geometry?.type === 'Point')
        .map((f, i) => ({
          id: i,
          lat: f.geometry.coordinates[1],
          lon: f.geometry.coordinates[0],
          properties: f.properties || {}
        }))

      setHydrants(hydrantPoints)
    } catch (err) {
      console.warn('Could not load hydrants:', err)
    }
  }

  // Load stations from GeoJSON URL
  const loadStationsFromUrl = async (url) => {
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const data = await response.json()
      const features = data.features || []

      const stationPoints = features.map((f, i) => {
        const { lat, lon } = extractCoordinates(f)
        const props = f.properties || {}
        const stationName = props.STATION || props.station || props.NAME || `Station ${i + 1}`

        return {
          id: i,
          lat,
          lon,
          name: stationName,
          agency: props.AGENCY || props.agency || 'Unknown',
          properties: props
        }
      }).filter(s => s.lat && s.lon)

      setStations(stationPoints)
    } catch (err) {
      console.warn('Could not load stations:', err)
    }
  }

  // Load addresses from CSV URL with streaming for better performance
  const loadAddressesFromUrl = async (url) => {
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const text = await response.text()
      const lines = text.split('\n')
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))

      const latCol = headers.findIndex(h => h === 'Latitude_Y' || h === 'y' || h === 'lat')
      const lonCol = headers.findIndex(h => h === 'Longitude_X' || h === 'x' || h === 'lon')
      const addrCol = headers.findIndex(h => h === 'Address_Line_1' || h === 'address')
      const cityCol = headers.findIndex(h => h === 'Postal_City' || h === 'city')
      const zipCol = headers.findIndex(h => h === 'Zip_Code' || h === 'zip')
      const jurisdictionCol = headers.findIndex(h => h === 'Jurisdiction')

      if (latCol === -1 || lonCol === -1) {
        throw new Error('CSV must have latitude/longitude columns')
      }

      const totalLines = lines.length - 1
      const addressPoints = new Array(totalLines) // Pre-allocate array for performance
      let validCount = 0

      // Process in chunks to prevent UI blocking
      const CHUNK_SIZE = 10000
      const totalChunks = Math.ceil((lines.length - 1) / CHUNK_SIZE)
      let currentChunk = 0

      const processChunk = (startIdx) => {
        return new Promise(resolve => {
          const endIdx = Math.min(startIdx + CHUNK_SIZE, lines.length)

          for (let i = startIdx; i < endIdx; i++) {
            const line = lines[i]
            if (!line || !line.trim()) continue

            const values = parseCSVLine(line)
            const lat = parseFloat(values[latCol])
            const lon = parseFloat(values[lonCol])

            if (isNaN(lat) || isNaN(lon)) continue

            addressPoints[validCount++] = {
              id: i,
              lat,
              lon,
              address: addrCol !== -1 ? values[addrCol] : '',
              city: cityCol !== -1 ? values[cityCol] : '',
              zip: zipCol !== -1 ? values[zipCol] : '',
              jurisdiction: jurisdictionCol !== -1 ? values[jurisdictionCol] : ''
            }
          }

          currentChunk++
          // Calculate progress based on completed chunks (more reliable than line position)
          const progress = Math.round((currentChunk / totalChunks) * 100)

          // Only update if progress increased - use ref to prevent backwards counting
          // The ref persists across renders and async operations
          if (progress > maxProgressRef.current) {
            maxProgressRef.current = progress
            setLoadingText(`Loading addresses... ${progress}%`)
          }

          // Use setTimeout to yield to UI thread
          setTimeout(resolve, 0)
        })
      }

      // Process all chunks sequentially
      for (let i = 1; i < lines.length; i += CHUNK_SIZE) {
        await processChunk(i)
      }

      // Trim the array to actual size
      addressPoints.length = validCount

      setAddresses(addressPoints)
    } catch (err) {
      console.warn('Could not load addresses:', err)
    }
  }

  const loadGeoJSON = useCallback((file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result)
          resolve(data)
        } catch (err) {
          reject(err)
        }
      }
      reader.onerror = reject
      reader.readAsText(file)
    })
  }, [])

  const loadHydrants = useCallback(async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setLoadingText('Loading hydrants...')

    try {
      const data = await loadGeoJSON(file)
      const features = data.features || []

      const hydrantPoints = features
        .filter(f => f.geometry?.type === 'Point')
        .map((f, i) => ({
          id: i,
          lat: f.geometry.coordinates[1],
          lon: f.geometry.coordinates[0],
          properties: f.properties || {}
        }))

      setHydrants(hydrantPoints)
    } catch (err) {
      console.error('Error loading hydrants:', err)
      alert('Error loading hydrants: ' + err.message)
    } finally {
      setLoading(false)
    }
  }, [loadGeoJSON])

  const loadStations = useCallback(async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setLoadingText('Loading stations...')

    try {
      const data = await loadGeoJSON(file)
      const features = data.features || []

      const stationPoints = features.map((f, i) => {
        const { lat, lon } = extractCoordinates(f)
        const props = f.properties || {}

        // Try to match with station coverage data for enrichment
        const stationName = props.STATION || props.station || props.NAME || `Station ${i + 1}`
        const coverageInfo = stationCoverageData.find(sc =>
          sc.stationName === stationName ||
          (sc.latitude && Math.abs(sc.latitude - lat) < 0.001 && Math.abs(sc.longitude - lon) < 0.001)
        )

        return {
          id: i,
          lat,
          lon,
          name: stationName,
          agency: props.AGENCY || props.agency || coverageInfo?.agency || 'Unknown',
          properties: props,
          coverageInfo: coverageInfo || null
        }
      }).filter(s => s.lat && s.lon)

      setStations(stationPoints)
    } catch (err) {
      console.error('Error loading stations:', err)
      alert('Error loading stations: ' + err.message)
    } finally {
      setLoading(false)
    }
  }, [loadGeoJSON, stationCoverageData])

  const loadAddresses = useCallback(async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setLoadingText('Loading addresses...')

    try {
      const text = await file.text()
      const lines = text.split('\n')
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))

      const latCol = headers.findIndex(h => h === 'Latitude_Y' || h === 'y' || h === 'lat')
      const lonCol = headers.findIndex(h => h === 'Longitude_X' || h === 'x' || h === 'lon')
      const addrCol = headers.findIndex(h => h === 'Address_Line_1' || h === 'address')
      const cityCol = headers.findIndex(h => h === 'Postal_City' || h === 'city')
      const zipCol = headers.findIndex(h => h === 'Zip_Code' || h === 'zip')
      const jurisdictionCol = headers.findIndex(h => h === 'Jurisdiction')

      if (latCol === -1 || lonCol === -1) {
        throw new Error('CSV must have latitude/longitude columns')
      }

      const addressPoints = []

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i]
        if (!line.trim()) continue

        const values = parseCSVLine(line)

        const lat = parseFloat(values[latCol])
        const lon = parseFloat(values[lonCol])

        if (isNaN(lat) || isNaN(lon)) continue

        addressPoints.push({
          id: i,
          lat,
          lon,
          address: addrCol !== -1 ? values[addrCol] : '',
          city: cityCol !== -1 ? values[cityCol] : '',
          zip: zipCol !== -1 ? values[zipCol] : '',
          jurisdiction: jurisdictionCol !== -1 ? values[jurisdictionCol] : ''
        })

        // Progress update
        if (i % 10000 === 0) {
          setLoadingText(`Loading addresses... ${Math.round(i / lines.length * 100)}%`)
        }
      }

      setAddresses(addressPoints)
    } catch (err) {
      console.error('Error loading addresses:', err)
      alert('Error loading addresses: ' + err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadZipcodes = useCallback(async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setLoadingText('Loading ZIP codes...')

    try {
      const data = await loadGeoJSON(file)
      const features = data.features || []

      const zipcodePolygons = features.map((f, i) => {
        const props = f.properties || {}
        return {
          id: i,
          zipCode: props.ZIP5 || props.zip || props.ZIPCODE || 'Unknown',
          poName: props.PO_NAME || props.po_name || props.city || '',
          color: ZIP_COLORS[i % ZIP_COLORS.length],
          geoJsonFeature: f
        }
      })

      setZipcodes(zipcodePolygons)
    } catch (err) {
      console.error('Error loading ZIP codes:', err)
      alert('Error loading ZIP codes: ' + err.message)
    } finally {
      setLoading(false)
    }
  }, [loadGeoJSON])

  // Load boundary from CSV (lat,lon pairs)
  const loadBoundary = useCallback(async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setLoadingText('Loading boundary...')

    try {
      const text = await file.text()
      const lines = text.split('\n').filter(l => l.trim())

      const coordinates = lines.map(line => {
        const [lat, lon] = line.split(',').map(v => parseFloat(v.trim()))
        return [lat, lon]
      }).filter(([lat, lon]) => !isNaN(lat) && !isNaN(lon))

      if (coordinates.length > 0) {
        setBoundary(coordinates)
      }
    } catch (err) {
      console.error('Error loading boundary:', err)
      alert('Error loading boundary: ' + err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    hydrants,
    stations,
    addresses,
    zipcodes,
    boundary,
    agencyStats,
    stationCoverageData,
    loading,
    loadingText,
    layerVisibility,
    setLayerVisibility,
    loadHydrants,
    loadStations,
    loadAddresses,
    loadZipcodes,
    loadBoundary
  }
}
