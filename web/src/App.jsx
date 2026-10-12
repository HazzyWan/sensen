import { useEffect, useState } from 'react'

// Where the API lives. In M4 the live address comes from an environment variable.
const API = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'

export default function App() {
  const [meta, setMeta] = useState(null)
  const [error, setError] = useState(null)

  // Runs once when the page loads: ask the API what data it is serving.
  useEffect(() => {
    fetch(`${API}/meta`)
      .then((res) => {
        if (!res.ok) throw new Error(`API answered ${res.status}`)
        return res.json()
      })
      .then(setMeta)
      .catch((err) => setError(err.message))
  }, [])

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 480, margin: '0 auto', padding: 16 }}>
      <h1>SenSen</h1>
      {error && <p style={{ color: 'crimson' }}>Could not reach the API: {error}</p>}
      {!meta && !error && <p>Loading…</p>}
      {meta && (
        <ul>
          <li>Latest week: {meta.latest_week}</li>
          <li>Regions: {meta.regions.join(', ')}</li>
          <li>Districts: {meta.districts}</li>
          <li>Items with a price label: {meta.items_with_label}</li>
        </ul>
      )}
    </main>
  )
}