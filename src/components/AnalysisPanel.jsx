import { useEffect, useRef, useMemo, useState, useCallback } from 'react'
import * as d3 from 'd3'
import './AnalysisPanel.css'

function AnalysisPanel({
  isOpen,
  onClose,
  onOpen,
  hydrantCount,
  stationCount,
  addressCount,
  zipcodeCount,
  globalSummary,
  addressDistancesReady,
  hasData
}) {
  const donutRef = useRef(null)
  const barRef = useRef(null)
  const densityRef = useRef(null)

  // Draggable panel state
  const [position, setPosition] = useState({ x: null, y: null })
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef(null)
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 })

  // Initialize center position when panel opens
  useEffect(() => {
    if (isOpen && position.x === null) {
      const panelWidth = 420
      const panelHeight = Math.min(window.innerHeight * 0.85, 700)
      setPosition({
        x: (window.innerWidth - panelWidth) / 2,
        y: (window.innerHeight - panelHeight) / 2
      })
    }
  }, [isOpen, position.x])

  // Reset position when panel closes
  useEffect(() => {
    if (!isOpen) {
      setPosition({ x: null, y: null })
    }
  }, [isOpen])

  // Drag handlers
  const handleMouseDown = useCallback((e) => {
    if (e.target.closest('.analysis-close')) return
    setIsDragging(true)
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y
    }
    e.preventDefault()
  }, [position])

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return
    const dx = e.clientX - dragStartRef.current.x
    const dy = e.clientY - dragStartRef.current.y
    setPosition({
      x: Math.max(0, Math.min(window.innerWidth - 420, dragStartRef.current.posX + dx)),
      y: Math.max(0, Math.min(window.innerHeight - 100, dragStartRef.current.posY + dy))
    })
  }, [isDragging])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  // Compute additional metrics
  const metrics = useMemo(() => {
    if (!globalSummary || addressCount === 0) return null

    const within500 = globalSummary.within500ft || 0
    const within1000 = globalSummary.within1000ft || 0
    const underserved = globalSummary.underserved || 0
    const total = addressCount

    // Risk score: weighted combination of coverage metrics (0-100, lower is better)
    const riskScore = Math.round(
      (underserved / total) * 100 * 0.6 +
      ((total - within500) / total) * 100 * 0.4
    )

    // Coverage efficiency: how well hydrants are distributed
    const coverageEfficiency = hydrantCount > 0
      ? Math.round((within500 / hydrantCount) * 10) / 10
      : 0

    // Addresses per hydrant
    const addressesPerHydrant = hydrantCount > 0
      ? Math.round(addressCount / hydrantCount)
      : 0

    // Service area estimate (sq ft per hydrant assuming 500ft radius)
    const serviceAreaPerHydrant = Math.round(Math.PI * 500 * 500)

    return {
      within500,
      within1000,
      underserved,
      riskScore,
      coverageEfficiency,
      addressesPerHydrant,
      serviceAreaPerHydrant,
      marginalCoverage: within1000 - within500
    }
  }, [globalSummary, addressCount, hydrantCount])

  // Donut Chart - Coverage Breakdown
  useEffect(() => {
    if (!isOpen || !globalSummary || !donutRef.current) return

    const container = donutRef.current
    container.innerHTML = ''

    const width = 180
    const height = 180
    const radius = Math.min(width, height) / 2

    const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${width / 2}, ${height / 2})`)

    const within500 = globalSummary.within500ft || 0
    const within1000Only = (globalSummary.within1000ft || 0) - within500
    const underserved = globalSummary.underserved || 0

    const data = [
      { label: 'Within 500ft', value: within500, color: '#22c55e' },
      { label: '500-1000ft', value: within1000Only, color: '#eab308' },
      { label: 'Underserved', value: underserved, color: '#ef4444' }
    ].filter(d => d.value > 0)

    const pie = d3.pie()
      .value(d => d.value)
      .sort(null)
      .padAngle(0.02)

    const arc = d3.arc()
      .innerRadius(radius * 0.6)
      .outerRadius(radius * 0.9)

    const arcs = svg.selectAll('path')
      .data(pie(data))
      .enter()
      .append('path')
      .attr('fill', d => d.data.color)
      .attr('stroke', 'var(--bg-panel)')
      .attr('stroke-width', 2)
      .style('opacity', 0)
      .style('cursor', 'pointer')

    // Animate in
    arcs.transition()
      .duration(800)
      .delay((d, i) => i * 150)
      .style('opacity', 1)
      .attrTween('d', function(d) {
        const interpolate = d3.interpolate({ startAngle: d.startAngle, endAngle: d.startAngle }, d)
        return t => arc(interpolate(t))
      })

    // Hover effect
    arcs.on('mouseover', function() {
      d3.select(this).transition().duration(200).attr('transform', 'scale(1.05)')
    }).on('mouseout', function() {
      d3.select(this).transition().duration(200).attr('transform', 'scale(1)')
    })

    // Center text
    const centerGroup = svg.append('g')
      .attr('class', 'center-text')

    const pctText = centerGroup.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-0.2em')
      .attr('fill', 'var(--text-primary)')
      .attr('font-size', '24px')
      .attr('font-weight', '700')
      .attr('font-family', "'DM Mono', monospace")
      .text(globalSummary.pctWithin500 + '%')
      .style('opacity', 0)

    pctText.transition()
      .delay(600)
      .duration(400)
      .style('opacity', 1)

    centerGroup.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '1.2em')
      .attr('fill', 'var(--text-muted)')
      .attr('font-size', '11px')
      .attr('letter-spacing', '1px')
      .text('OPTIMAL')
      .style('opacity', 0)
      .transition()
      .delay(700)
      .duration(400)
      .style('opacity', 1)

    // Cleanup function to stop all D3 transitions when unmounting
    return () => {
      d3.select(container).selectAll('*').interrupt()
    }
  }, [isOpen, globalSummary])

  // Bar Chart - Distance Distribution
  useEffect(() => {
    if (!isOpen || !globalSummary || !barRef.current) return

    const container = barRef.current
    container.innerHTML = ''

    const margin = { top: 15, right: 15, bottom: 35, left: 50 }
    const width = 280 - margin.left - margin.right
    const height = 140 - margin.top - margin.bottom

    const svg = d3.select(container)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`)

    const within500 = globalSummary.within500ft || 0
    const within1000Only = (globalSummary.within1000ft || 0) - within500
    const underserved = globalSummary.underserved || 0

    const data = [
      { label: 'Optimal', value: within500, color: '#22c55e' },
      { label: 'Marginal', value: within1000Only, color: '#eab308' },
      { label: 'At Risk', value: underserved, color: '#ef4444' }
    ]

    const x = d3.scaleBand()
      .domain(data.map(d => d.label))
      .range([0, width])
      .padding(0.3)

    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.value) * 1.15])
      .range([height, 0])

    // X axis
    svg.append('g')
      .attr('transform', `translate(0, ${height})`)
      .call(d3.axisBottom(x).tickSize(0))
      .selectAll('text')
      .attr('fill', 'var(--text-muted)')
      .attr('font-size', '9px')

    svg.selectAll('.domain').attr('stroke', 'var(--border)')

    // Y axis
    svg.append('g')
      .call(d3.axisLeft(y).ticks(4).tickFormat(d3.format('.2s')))
      .selectAll('text')
      .attr('fill', 'var(--text-muted)')
      .attr('font-size', '9px')

    // Bars with hover
    svg.selectAll('rect')
      .data(data)
      .enter()
      .append('rect')
      .attr('x', d => x(d.label))
      .attr('width', x.bandwidth())
      .attr('y', height)
      .attr('height', 0)
      .attr('fill', d => d.color)
      .attr('rx', 4)
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        d3.select(this).attr('opacity', 0.8)
      })
      .on('mouseout', function() {
        d3.select(this).attr('opacity', 1)
      })
      .transition()
      .duration(800)
      .delay((d, i) => i * 150)
      .attr('y', d => y(d.value))
      .attr('height', d => height - y(d.value))

    // Value labels on top of bars
    svg.selectAll('.bar-label')
      .data(data)
      .enter()
      .append('text')
      .attr('class', 'bar-label')
      .attr('x', d => x(d.label) + x.bandwidth() / 2)
      .attr('y', d => y(d.value) - 5)
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--text-secondary)')
      .attr('font-size', '9px')
      .attr('font-family', "'DM Mono', monospace")
      .text(d => d.value.toLocaleString())
      .style('opacity', 0)
      .transition()
      .delay(1000)
      .duration(300)
      .style('opacity', 1)

    // Cleanup function to stop all D3 transitions
    return () => {
      d3.select(container).selectAll('*').interrupt()
    }
  }, [isOpen, globalSummary])

  // Density gauge
  useEffect(() => {
    if (!isOpen || !densityRef.current || hydrantCount === 0 || addressCount === 0) return

    const container = densityRef.current
    container.innerHTML = ''

    const density = (hydrantCount / addressCount) * 1000
    const maxDensity = 100 // Max expected density per 1000 addresses
    const normalizedDensity = Math.min(density / maxDensity, 1)

    const width = 280
    const height = 30

    const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)

    // Background track
    svg.append('rect')
      .attr('x', 0)
      .attr('y', 10)
      .attr('width', width)
      .attr('height', 10)
      .attr('rx', 5)
      .attr('fill', 'var(--bg-dark)')

    // Gradient fill
    const gradient = svg.append('defs')
      .append('linearGradient')
      .attr('id', 'density-gradient')
      .attr('x1', '0%')
      .attr('x2', '100%')

    gradient.append('stop').attr('offset', '0%').attr('stop-color', '#ef4444')
    gradient.append('stop').attr('offset', '50%').attr('stop-color', '#eab308')
    gradient.append('stop').attr('offset', '100%').attr('stop-color', '#22c55e')

    // Progress bar
    svg.append('rect')
      .attr('x', 0)
      .attr('y', 10)
      .attr('width', 0)
      .attr('height', 10)
      .attr('rx', 5)
      .attr('fill', 'url(#density-gradient)')
      .transition()
      .duration(1000)
      .attr('width', width * normalizedDensity)

    // Marker
    const marker = svg.append('circle')
      .attr('cx', 0)
      .attr('cy', 15)
      .attr('r', 6)
      .attr('fill', 'white')
      .attr('stroke', 'var(--bg-panel)')
      .attr('stroke-width', 2)

    marker.transition()
      .duration(1000)
      .attr('cx', width * normalizedDensity)

    // Cleanup function to stop all D3 transitions
    return () => {
      d3.select(container).selectAll('*').interrupt()
    }
  }, [isOpen, hydrantCount, addressCount])

  const ratio = hydrantCount > 0 && stationCount > 0
    ? (hydrantCount / stationCount).toFixed(1)
    : '—'

  const density = hydrantCount > 0 && addressCount > 0
    ? ((hydrantCount / addressCount) * 1000).toFixed(1)
    : '—'

  // Calculate coverage grade
  const getCoverageGrade = () => {
    if (!globalSummary) return { grade: '—', color: 'var(--text-muted)', label: '' }
    const pct = parseFloat(globalSummary.pctWithin500)
    if (pct >= 90) return { grade: 'A', color: '#22c55e', label: 'Excellent' }
    if (pct >= 80) return { grade: 'B', color: '#84cc16', label: 'Good' }
    if (pct >= 70) return { grade: 'C', color: '#eab308', label: 'Moderate' }
    if (pct >= 60) return { grade: 'D', color: '#f97316', label: 'Below Average' }
    return { grade: 'F', color: '#ef4444', label: 'Needs Improvement' }
  }

  const grade = getCoverageGrade()

  // Get risk level description
  const getRiskDescription = () => {
    if (!metrics) return ''
    if (metrics.riskScore < 10) return 'Very Low Risk'
    if (metrics.riskScore < 25) return 'Low Risk'
    if (metrics.riskScore < 40) return 'Moderate Risk'
    if (metrics.riskScore < 60) return 'Elevated Risk'
    return 'High Risk'
  }

  return (
    <>
      {/* Floating toggle button - centered */}
      {hasData && !isOpen && (
        <button className="analysis-toggle-btn" onClick={onOpen}>
          <span>Analysis</span>
        </button>
      )}

      <div
        className={`analysis-panel ${isOpen ? 'open' : ''} ${isDragging ? 'dragging' : ''}`}
        style={isOpen && position.x !== null ? {
          left: position.x,
          top: position.y,
          right: 'auto',
          bottom: 'auto',
          transform: 'none'
        } : {}}
        ref={dragRef}
      >
        <div
          className="analysis-header"
          onMouseDown={handleMouseDown}
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        >
          <h2>Coverage Analysis</h2>
          <button className="analysis-close" onClick={onClose}>×</button>
        </div>

        <div className="analysis-content">
          {/* Coverage Grade */}
          {globalSummary && (
            <div className="grade-section">
              <div className="grade-badge" style={{ borderColor: grade.color }}>
                <span className="grade-letter" style={{ color: grade.color }}>{grade.grade}</span>
              </div>
              <div className="grade-info">
                <span className="grade-title">{grade.label}</span>
                <span className="grade-subtitle">{globalSummary.pctWithin500}% within optimal range</span>
              </div>
            </div>
          )}

          {/* Quick Stats */}
          <div className="quick-stats">
            <div className="quick-stat">
              <span className="quick-value hydrant">{hydrantCount.toLocaleString()}</span>
              <span className="quick-label">Hydrants</span>
            </div>
            <div className="quick-stat">
              <span className="quick-value station">{stationCount.toLocaleString()}</span>
              <span className="quick-label">Stations</span>
            </div>
            <div className="quick-stat">
              <span className="quick-value address">{addressCount.toLocaleString()}</span>
              <span className="quick-label">Addresses</span>
            </div>
            <div className="quick-stat">
              <span className="quick-value ratio">{ratio}</span>
              <span className="quick-label">Hydrants/Station</span>
            </div>
          </div>

          {/* Coverage Donut */}
          {addressDistancesReady && globalSummary ? (
            <>
              <div className="chart-section">
                <h3>Address Coverage by Distance</h3>
                <p className="chart-description">
                  Distribution of addresses by proximity to nearest fire hydrant
                </p>
                <div className="chart-container">
                  <div ref={donutRef} className="donut-chart" />
                  <div className="chart-legend">
                    <div className="legend-item">
                      <span className="legend-color" style={{ background: '#22c55e' }} />
                      <span>Within 500 ft — Optimal coverage</span>
                    </div>
                    <div className="legend-item">
                      <span className="legend-color" style={{ background: '#eab308' }} />
                      <span>500–1,000 ft — Marginal coverage</span>
                    </div>
                    <div className="legend-item">
                      <span className="legend-color" style={{ background: '#ef4444' }} />
                      <span>Beyond 1,000 ft — At risk</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="chart-section">
                <h3>Coverage Distribution</h3>
                <p className="chart-description">
                  Number of addresses in each coverage zone
                </p>
                <div ref={barRef} className="bar-chart" />
              </div>

              {/* Density Gauge */}
              <div className="chart-section">
                <h3>Infrastructure Density</h3>
                <div className="density-info">
                  <span>{density}</span>
                  <span className="density-unit">hydrants per 1,000 addresses</span>
                </div>
                <div ref={densityRef} className="density-gauge" />
                <div className="density-scale">
                  <span>Sparse</span>
                  <span>Dense</span>
                </div>
              </div>

              {/* Additional Metrics */}
              {metrics && (
                <div className="chart-section">
                  <h3>Performance Metrics</h3>
                  <div className="metrics-grid">
                    <div className="metric-card">
                      <span className="metric-value">{metrics.addressesPerHydrant}</span>
                      <span className="metric-label">Addresses per Hydrant</span>
                    </div>
                    <div className="metric-card">
                      <span className="metric-value">{Math.round(globalSummary.avgDistance).toLocaleString()} ft</span>
                      <span className="metric-label">Avg. Distance to Hydrant</span>
                    </div>
                    <div className="metric-card">
                      <span className="metric-value" style={{ color: metrics.riskScore < 25 ? '#22c55e' : metrics.riskScore < 50 ? '#eab308' : '#ef4444' }}>
                        {getRiskDescription()}
                      </span>
                      <span className="metric-label">Overall Risk Assessment</span>
                    </div>
                    {stationCount > 0 && (
                      <div className="metric-card">
                        <span className="metric-value">{Math.round(addressCount / stationCount).toLocaleString()}</span>
                        <span className="metric-label">Addresses per Station</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Insights */}
              <div className="insights-section">
                <h3>Analysis Summary</h3>
                <div className="insight-cards">
                  <div className={`insight-card ${parseFloat(globalSummary.pctWithin500) >= 80 ? 'good' : 'warning'}`}>
                    <span className="insight-icon">{parseFloat(globalSummary.pctWithin500) >= 80 ? '✓' : '!'}</span>
                    <p>
                      <strong>{globalSummary.pctWithin500}%</strong> of addresses have a fire hydrant within 500 ft,
                      meeting the recommended standard for urban fire protection.
                    </p>
                  </div>
                  {globalSummary.underserved > 0 && (
                    <div className="insight-card danger">
                      <span className="insight-icon">!</span>
                      <p>
                        <strong>{globalSummary.underserved.toLocaleString()}</strong> addresses ({((globalSummary.underserved / addressCount) * 100).toFixed(1)}%)
                        are more than 1,000 ft from the nearest hydrant. These locations may experience
                        delayed fire response times and should be prioritized for infrastructure improvements.
                      </p>
                    </div>
                  )}
                  {metrics && metrics.marginalCoverage > 0 && (
                    <div className="insight-card info">
                      <span className="insight-icon">i</span>
                      <p>
                        <strong>{metrics.marginalCoverage.toLocaleString()}</strong> addresses fall in the marginal
                        coverage zone (500–1,000 ft). Consider strategic hydrant placement to bring these
                        addresses into optimal range.
                      </p>
                    </div>
                  )}
                  {stationCount > 0 && hydrantCount > 0 && (
                    <div className="insight-card info">
                      <span className="insight-icon">i</span>
                      <p>
                        The county maintains approximately <strong>{Math.round(hydrantCount / stationCount)}</strong> hydrants
                        per fire station, supporting a total service area covering <strong>{addressCount.toLocaleString()}</strong> addresses.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="no-analysis">
              <div className="no-analysis-icon">📊</div>
              <p>Load address data to analyze coverage</p>
              <span className="no-analysis-hint">
                Address data enables distance calculations to the nearest hydrant for each property
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default AnalysisPanel
