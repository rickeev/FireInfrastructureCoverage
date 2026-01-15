/**
 * Web Worker for Fire Infrastructure Coverage Analysis
 */

// Grid-based spatial index for fast nearest neighbor queries
class SpatialGrid {
  constructor(cellSizeDegrees = 0.005) {
    this.cellSize = cellSizeDegrees
    this.grid = new Map()
    this.allPoints = []
  }

  clear() {
    this.grid.clear()
    this.allPoints = []
  }

  getCell(lat, lon) {
    const cellX = Math.floor(lon / this.cellSize)
    const cellY = Math.floor(lat / this.cellSize)
    return `${cellX},${cellY}`
  }

  insert(lat, lon, data = null) {
    const point = { lat, lon, data }
    this.allPoints.push(point)

    const cell = this.getCell(lat, lon)
    if (!this.grid.has(cell)) {
      this.grid.set(cell, [])
    }
    this.grid.get(cell).push(point)
  }

  getNearbyPoints(lat, lon, radiusCells = 2) {
    const centerCellX = Math.floor(lon / this.cellSize)
    const centerCellY = Math.floor(lat / this.cellSize)
    const nearby = []

    for (let dx = -radiusCells; dx <= radiusCells; dx++) {
      for (let dy = -radiusCells; dy <= radiusCells; dy++) {
        const cell = `${centerCellX + dx},${centerCellY + dy}`
        const points = this.grid.get(cell)
        if (points) {
          nearby.push(...points)
        }
      }
    }
    return nearby
  }

  findNearest(lat, lon) {
    for (let radius = 1; radius <= 20; radius++) {
      const candidates = this.getNearbyPoints(lat, lon, radius)
      if (candidates.length > 0) {
        let bestDist = Infinity
        let bestPoint = null

        for (const point of candidates) {
          const dist = haversineDistance(lat, lon, point.lat, point.lon)
          if (dist < bestDist) {
            bestDist = dist
            bestPoint = point
          }
        }

        return { point: bestPoint, distance: bestDist }
      }
    }
    return { point: null, distance: Infinity }
  }
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 20902231 // Earth's radius in feet
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function pointInPolygon(lat, lon, polygon) {
  const geomType = polygon.geometry.type
  let rings

  if (geomType === 'Polygon') {
    rings = [polygon.geometry.coordinates[0]]
  } else if (geomType === 'MultiPolygon') {
    rings = polygon.geometry.coordinates.map(p => p[0])
  } else {
    return false
  }

  for (const coords of rings) {
    let inside = false
    for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
      const xi = coords[i][0], yi = coords[i][1]
      const xj = coords[j][0], yj = coords[j][1]

      if (((yi > lat) !== (yj > lat)) &&
          (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
        inside = !inside
      }
    }
    if (inside) return true
  }
  return false
}

// Calculate approximate area of a polygon in square miles
function calculatePolygonArea(polygon) {
  const geomType = polygon.geometry.type
  let coords

  if (geomType === 'Polygon') {
    coords = polygon.geometry.coordinates[0]
  } else if (geomType === 'MultiPolygon') {
    // Sum areas of all polygons
    let totalArea = 0
    for (const poly of polygon.geometry.coordinates) {
      totalArea += calculateRingArea(poly[0])
    }
    return totalArea
  } else {
    return 0
  }

  return calculateRingArea(coords)
}

function calculateRingArea(coords) {
  // Shoelace formula for polygon area, approximating lat/lon to miles
  // 1 degree lat ≈ 69 miles, 1 degree lon varies by latitude
  const avgLat = coords.reduce((sum, c) => sum + c[1], 0) / coords.length
  const lonToMiles = 69 * Math.cos(avgLat * Math.PI / 180)
  const latToMiles = 69

  let area = 0
  for (let i = 0; i < coords.length - 1; i++) {
    const x1 = coords[i][0] * lonToMiles
    const y1 = coords[i][1] * latToMiles
    const x2 = coords[i + 1][0] * lonToMiles
    const y2 = coords[i + 1][1] * latToMiles
    area += x1 * y2 - x2 * y1
  }

  return Math.abs(area / 2)
}

// Global state
let hydrantGrid = new SpatialGrid(0.005)
let stationGrid = new SpatialGrid(0.01) // Larger cells for stations
let addressesWithDistances = []
let hydrantsList = []
let stationsList = []

// Message handler
self.onmessage = function(e) {
  const { type, data } = e.data

  switch (type) {
    case 'buildHydrantIndex':
      buildHydrantIndex(data.hydrants)
      break

    case 'setStations':
      setStations(data.stations)
      break

    case 'precomputeAddressDistances':
      precomputeAddressDistances(data.addresses)
      break

    case 'analyzeZipCode':
      analyzeZipCode(data.zipCodeFeature)
      break
  }
}

function buildHydrantIndex(hydrants) {
  const startTime = performance.now()

  hydrantGrid.clear()
  hydrantsList = hydrants

  for (const h of hydrants) {
    hydrantGrid.insert(h.lat, h.lon)
  }

  const elapsed = performance.now() - startTime

  self.postMessage({
    type: 'hydrantIndexReady',
    data: { count: hydrants.length, elapsed }
  })
}

function setStations(stations) {
  stationGrid.clear()
  stationsList = stations

  for (const s of stations) {
    stationGrid.insert(s.lat, s.lon, s)
  }

  self.postMessage({
    type: 'stationsIndexReady',
    data: { count: stations.length }
  })
}

function precomputeAddressDistances(addresses) {
  const startTime = performance.now()

  addressesWithDistances = []
  const ONE_MILE_FT = 5280

  for (let i = 0; i < addresses.length; i++) {
    const addr = addresses[i]
    const nearestHydrant = hydrantGrid.findNearest(addr.lat, addr.lon)

    // Find nearest station
    let nearestStation = { point: null, distance: Infinity }
    if (stationsList.length > 0) {
      nearestStation = stationGrid.findNearest(addr.lat, addr.lon)
    }

    addressesWithDistances.push({
      ...addr,
      nearestHydrantDist: nearestHydrant.distance,
      nearestStationDist: nearestStation.distance,
      nearestStationData: nearestStation.point?.data || null,
      within500ft: nearestHydrant.distance <= 500,
      within1000ft: nearestHydrant.distance <= 1000,
      underserved: nearestHydrant.distance > 1000,
      withinStationMile: nearestStation.distance <= ONE_MILE_FT
    })

    if ((i + 1) % 5000 === 0) {
      self.postMessage({
        type: 'progress',
        task: 'precomputeAddressDistances',
        current: i + 1,
        total: addresses.length
      })
    }
  }

  const elapsed = performance.now() - startTime

  const within500 = addressesWithDistances.filter(a => a.within500ft).length
  const within1000 = addressesWithDistances.filter(a => a.within1000ft).length
  const underserved = addressesWithDistances.filter(a => a.underserved).length
  const withinStationMile = addressesWithDistances.filter(a => a.withinStationMile).length
  const avgDist = addressesWithDistances.reduce((sum, a) => sum + a.nearestHydrantDist, 0) / addressesWithDistances.length
  const avgStationDist = stationsList.length > 0
    ? addressesWithDistances.reduce((sum, a) => sum + a.nearestStationDist, 0) / addressesWithDistances.length
    : 0

  self.postMessage({
    type: 'addressDistancesReady',
    data: {
      count: addressesWithDistances.length,
      elapsed,
      summary: {
        within500ft: within500,
        within1000ft: within1000,
        underserved,
        withinStationMile,
        avgDistance: avgDist,
        avgStationDistance: avgStationDist,
        pctWithin500: (within500 / addressesWithDistances.length * 100).toFixed(1),
        pctWithin1000: (within1000 / addressesWithDistances.length * 100).toFixed(1),
        pctWithinStationMile: stationsList.length > 0
          ? (withinStationMile / addressesWithDistances.length * 100).toFixed(1)
          : '0'
      }
    }
  })
}

function analyzeZipCode(zipCodeFeature) {
  const startTime = performance.now()
  const ONE_MILE_FT = 5280

  // Calculate area of ZIP code
  const areaSqMiles = calculatePolygonArea(zipCodeFeature)

  const stats = {
    hydrantCount: 0,
    stationCount: 0,
    addressCount: 0,
    addressesWithin500ft: 0,
    addressesWithin1000ft: 0,
    addressesUnderserved: 0,
    addressesWithinStationMile: 0,
    avgDistanceToHydrant: 0,
    avgDistanceToStation: 0,
    minDistance: Infinity,
    maxDistance: 0,
    areaSqMiles: areaSqMiles,
    // Density metrics
    addressDensity: 0, // addresses per sq mile
    hydrantDensityPerSqMile: 0,
    isRural: false,
    ruralNote: null
  }

  // Count hydrants in ZIP
  for (const h of hydrantsList) {
    if (pointInPolygon(h.lat, h.lon, zipCodeFeature)) {
      stats.hydrantCount++
    }
  }

  // Count stations in ZIP
  for (const s of stationsList) {
    if (pointInPolygon(s.lat, s.lon, zipCodeFeature)) {
      stats.stationCount++
    }
  }

  // Analyze addresses using pre-computed distances
  let totalHydrantDistance = 0
  let totalStationDistance = 0

  for (const addr of addressesWithDistances) {
    if (pointInPolygon(addr.lat, addr.lon, zipCodeFeature)) {
      stats.addressCount++
      totalHydrantDistance += addr.nearestHydrantDist
      totalStationDistance += addr.nearestStationDist

      if (addr.nearestHydrantDist < stats.minDistance) {
        stats.minDistance = addr.nearestHydrantDist
      }
      if (addr.nearestHydrantDist > stats.maxDistance) {
        stats.maxDistance = addr.nearestHydrantDist
      }

      if (addr.within500ft) stats.addressesWithin500ft++
      if (addr.within1000ft) stats.addressesWithin1000ft++
      if (addr.underserved) stats.addressesUnderserved++
      if (addr.withinStationMile) stats.addressesWithinStationMile++
    }
  }

  if (stats.addressCount > 0) {
    stats.avgDistanceToHydrant = totalHydrantDistance / stats.addressCount
    stats.avgDistanceToStation = totalStationDistance / stats.addressCount
    stats.coveragePercent500 = (stats.addressesWithin500ft / stats.addressCount * 100).toFixed(1)
    stats.coveragePercent1000 = (stats.addressesWithin1000ft / stats.addressCount * 100).toFixed(1)
    stats.stationCoveragePercent = (stats.addressesWithinStationMile / stats.addressCount * 100).toFixed(1)
    stats.hydrantDensity = (stats.hydrantCount / stats.addressCount * 1000).toFixed(1)
  } else {
    stats.coveragePercent500 = '0'
    stats.coveragePercent1000 = '0'
    stats.stationCoveragePercent = '0'
    stats.hydrantDensity = '0'
  }

  // Calculate density metrics for rural classification
  if (areaSqMiles > 0) {
    stats.addressDensity = stats.addressCount / areaSqMiles
    stats.hydrantDensityPerSqMile = stats.hydrantCount / areaSqMiles

    // Rural classification based on address density
    // Urban: > 1000 addresses/sq mi
    // Suburban: 100-1000 addresses/sq mi
    // Rural: < 100 addresses/sq mi
    if (stats.addressDensity < 100) {
      stats.isRural = true
      stats.areaType = 'Rural'
      stats.ruralNote = 'Low population density area. Fire departments may use tanker trucks or draft water from natural sources.'
    } else if (stats.addressDensity < 1000) {
      stats.areaType = 'Suburban'
      stats.ruralNote = null
    } else {
      stats.areaType = 'Urban'
      stats.ruralNote = null
    }
  }

  const elapsed = performance.now() - startTime

  self.postMessage({
    type: 'zipCodeAnalysisReady',
    data: { stats, elapsed }
  })
}
