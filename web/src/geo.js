// Distance and map helpers for "near me". Everything here runs on the phone:
// the user's location is never sent to the SenSen server.

// Straight-line distance between two points on Earth, in km (the haversine formula).
export function distanceKm(a, b) {
  const R = 6371 // Earth's radius in km
  const rad = (deg) => (deg * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLon = rad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// 0.43 -> "450 m", 3.27 -> "3.3 km"
export function kmText(km) {
  const m = Math.max(50, Math.round((km * 1000) / 50) * 50)
  return m < 1000 ? `${m} m` : `${km.toFixed(1)} km` // 0.99 km is "1.0 km", not "1000 m"
}

// A Google Maps link (free, no API key). Searching by the shop's name and area
// opens Google's own page for the shop (opening hours, photos, directions),
// which is more useful than a bare pin on the map.
// The neighbourhood ("Kota Damansara") finds the right branch better than the
// district, especially in KL where districts are parliament seats ("Batu").
export function mapsLink(shop) {
  const query = `${shop.shop}, ${shop.suburb ?? shop.district}`
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

// Farther than this from every shop we know, the user is outside Selangor and KL.
const OUTSIDE_KM = 25

// The area the user is in, from the 5 shops nearest to them: each shop votes
// for its own district, and closer shops count for more. Districts' borders
// aren't in our data, so the shops around you are the next best thing.
// areas: from /areas (each has points: [[lat, lon], ...]). here: { lat, lon }.
// Returns { district, km } (km to the nearest shop), or null if outside.
export function nearestArea(areas, here, k = 5) {
  const shops = areas.flatMap((a) =>
    a.points.map(([lat, lon]) => ({ district: a.district, km: distanceKm(here, { lat, lon }) })))
  if (!shops.length) return null
  shops.sort((a, b) => a.km - b.km)
  if (shops[0].km > OUTSIDE_KM) return null

  const votes = new Map()
  for (const s of shops.slice(0, k)) votes.set(s.district, (votes.get(s.district) ?? 0) + 1 / (0.5 + s.km))
  const [district] = [...votes].sort((a, b) => b[1] - a[1])[0]
  return { district, km: shops[0].km }
}