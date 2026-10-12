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
export const kmText = (km) => (km < 1 ? `${Math.max(50, Math.round((km * 1000) / 50) * 50)} m` : `${km.toFixed(1)} km`)

// A Google Maps link (free, no API key). Searching by the shop's name and area
// opens Google's own page for the shop (opening hours, photos, directions),
// which is more useful than a bare pin on the map.
export function mapsLink(shop) {
  const query = `${shop.shop}, ${shop.district}`
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}