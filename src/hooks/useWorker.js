import { useState, useEffect, useRef, useCallback } from 'react'

export function useWorker(hydrants, addresses, stations) {
  const [workerReady, setWorkerReady] = useState(false)
  const [hydrantIndexReady, setHydrantIndexReady] = useState(false)
  const [stationsIndexReady, setStationsIndexReady] = useState(false)
  const [addressDistancesReady, setAddressDistancesReady] = useState(false)
  const [globalSummary, setGlobalSummary] = useState(null)

  const workerRef = useRef(null)
  const pendingCallbackRef = useRef(null)

  // Initialize worker
  useEffect(() => {
    try {
      workerRef.current = new Worker(new URL('../workers/coverage.worker.js', import.meta.url), {
        type: 'module'
      })

      workerRef.current.onmessage = (e) => {
        const { type, data } = e.data

        switch (type) {
          case 'hydrantIndexReady':
            setHydrantIndexReady(true)
            break

          case 'stationsIndexReady':
            setStationsIndexReady(true)
            break

          case 'addressDistancesReady':
            setAddressDistancesReady(true)
            setGlobalSummary(data.summary)
            break

          case 'zipCodeAnalysisReady':
            if (pendingCallbackRef.current) {
              pendingCallbackRef.current(data.stats)
              pendingCallbackRef.current = null
            }
            break

          case 'error':
            console.error('Worker error:', data.message)
            break
        }
      }

      workerRef.current.onerror = (e) => {
        console.error('Worker error:', e)
        setWorkerReady(false)
      }

      setWorkerReady(true)
    } catch (err) {
      console.warn('Could not initialize worker:', err)
      setWorkerReady(false)
    }

    return () => {
      workerRef.current?.terminate()
    }
  }, [])

  // Send hydrants to worker when they change
  useEffect(() => {
    if (!workerReady || !workerRef.current || hydrants.length === 0) return

    setHydrantIndexReady(false)
    workerRef.current.postMessage({
      type: 'buildHydrantIndex',
      data: { hydrants }
    })
  }, [workerReady, hydrants])

  // Send stations to worker when they change
  useEffect(() => {
    if (!workerReady || !workerRef.current) return

    setStationsIndexReady(false)
    workerRef.current.postMessage({
      type: 'setStations',
      data: { stations }
    })
  }, [workerReady, stations])

  // Send addresses to worker when they change (and hydrants are indexed)
  useEffect(() => {
    if (!workerReady || !workerRef.current || !hydrantIndexReady || addresses.length === 0) return

    setAddressDistancesReady(false)
    workerRef.current.postMessage({
      type: 'precomputeAddressDistances',
      data: { addresses }
    })
  }, [workerReady, hydrantIndexReady, stationsIndexReady, addresses])

  const requestZipAnalysis = useCallback((geoJsonFeature, callback) => {
    if (!workerReady || !workerRef.current) {
      callback({ error: 'Worker not ready' })
      return
    }

    pendingCallbackRef.current = callback
    workerRef.current.postMessage({
      type: 'analyzeZipCode',
      data: { zipCodeFeature: geoJsonFeature }
    })
  }, [workerReady])

  return {
    workerReady,
    hydrantIndexReady,
    stationsIndexReady,
    addressDistancesReady,
    globalSummary,
    requestZipAnalysis
  }
}
