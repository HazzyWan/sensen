// Hand-drawn item icons from the SenSen prototype: [tile colour, SVG inside a 48x48 box].
// They are our own static drawings, so inserting them as HTML is safe.
export const ICONS = {
  chicken:['#ffe3c7','<ellipse cx="20" cy="20" rx="12" ry="10" transform="rotate(-35 20 20)" fill="#e38b3f"/><ellipse cx="17" cy="17" rx="6" ry="4" transform="rotate(-35 17 17)" fill="#f2a95f"/><rect x="26" y="24" width="5" height="13" rx="2.5" transform="rotate(-45 28.5 30.5)" fill="#fff4e6" stroke="#d9c2a2"/><circle cx="35" cy="37" r="3.2" fill="#fff4e6" stroke="#d9c2a2"/><circle cx="38" cy="34" r="3.2" fill="#fff4e6" stroke="#d9c2a2"/>'],
  egg:['#fff3c4','<ellipse cx="24" cy="26" rx="12" ry="15" fill="#fffaf0" stroke="#ecd9ad" stroke-width="1.5"/><circle cx="24" cy="29" r="6.5" fill="#ffb81c"/><circle cx="22" cy="27" r="2" fill="#ffd66b"/>'],
  rice:['#dbe8ff','<path d="M8 24h32a16 14 0 0 1-32 0z" fill="#3d7be0"/><path d="M11 24c0-7 6-12 13-12s13 5 13 12z" fill="#fff"/><path d="M8 24h32" stroke="#2c5fb3" stroke-width="2"/><circle cx="18" cy="19" r="1.2" fill="#dfe6f2"/><circle cx="25" cy="16" r="1.2" fill="#dfe6f2"/><circle cx="30" cy="20" r="1.2" fill="#dfe6f2"/><path d="M29 6l12 15M33 5l10 14" stroke="#8b5a2b" stroke-width="2" stroke-linecap="round"/><path d="M12 32h24" stroke="#6fa0f0" stroke-width="2" opacity=".6"/>'],
  fish:['#d6f0ff','<path d="M6 24c6-9 16-12 25-7l9-7v28l-9-7c-9 5-19 2-25-7z" fill="#3aa0e8"/><path d="M31 17l9-7v28l-9-7z" fill="#2a7fc0"/><path d="M8 24c5 5 13 7 21 4" stroke="#8fd0ff" stroke-width="2" fill="none"/><circle cx="14" cy="22" r="2.2" fill="#fff"/><circle cx="14" cy="22" r="1.1" fill="#123"/>'],
  meat:['#ffdfe0','<path d="M28 7c8 0 13 6 13 13 0 11-12 21-22 21-7 0-12-5-12-11C7 17 17 7 28 7z" fill="#f4c7c3"/><path d="M28 10c6 0 10 5 10 10 0 9-10 18-18 18-5 0-9-4-9-8 0-11 8-20 17-20z" fill="#d9424c"/><circle cx="27" cy="20" r="4.5" fill="#fff5f0" stroke="#e8bdb0"/><path d="M17 30c3-2 6-2 9 0" stroke="#f08a90" stroke-width="2" fill="none"/>'],
  veg:['#dff5dc','<path d="M16 42L30 16l5 5z" fill="#ff8a2a"/><path d="M22 34l4 1M25 28l4 1" stroke="#e06a10" stroke-width="1.6" stroke-linecap="round"/><path d="M31 17c1-6 5-9 10-9-1 5-4 8-8 9zM33 20c4-3 9-3 12 0-4 3-8 3-11 1zM30 15c-2-5-1-9 3-11 1 4 0 8-2 10z" fill="#3cb55e"/>'],
  oil:['#fff1c2','<rect x="20" y="4" width="8" height="6" rx="2" fill="#2f9a55"/><path d="M19 10h10l4 7v23a3 3 0 0 1-3 3H18a3 3 0 0 1-3-3V17z" fill="#ffe7a0" stroke="#e5c04a" stroke-width="1.2"/><path d="M15 24h18v16a3 3 0 0 1-3 3H18a3 3 0 0 1-3-3z" fill="#f5b70f"/><rect x="18" y="27" width="12" height="8" rx="2" fill="#fff" opacity=".9"/><path d="M20 12l-2 4" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".7"/>'],
  milk:['#dcecff','<path d="M16 12l4-7h10l4 7z" fill="#5aa3f0"/><path d="M14 12h20v30a2 2 0 0 1-2 2H16a2 2 0 0 1-2-2z" fill="#fff" stroke="#c9dcf2" stroke-width="1.2"/><path d="M14 26c4-3 8 3 12 0s6-2 8-1v17a2 2 0 0 1-2 2H16a2 2 0 0 1-2-2z" fill="#5aa3f0"/><circle cx="24" cy="18" r="3" fill="#ffcf4a"/>'],
  onion:['#f3dcf7','<path d="M24 7c-2 4-12 10-12 21a12 12 0 0 0 24 0C36 17 26 11 24 7z" fill="#b04fa8"/><path d="M24 12c-4 5-6 11-6 17s2 10 6 12M24 12c4 5 6 11 6 17s-2 10-6 12" stroke="#d98ad3" stroke-width="1.6" fill="none"/><path d="M24 7V2" stroke="#6cae3e" stroke-width="2.4" stroke-linecap="round"/><path d="M19 41h10" stroke="#e9d5b0" stroke-width="2" stroke-linecap="round"/>'],
  sugar:['#fde2ef','<path d="M8 22l10-5 10 5-10 5z" fill="#fff"/><path d="M8 22v10l10 5V27z" fill="#e9eef5"/><path d="M28 22v10l-10 5V27z" fill="#d6dde8"/><path d="M22 14l9-4 9 4-9 4z" fill="#fff"/><path d="M22 14v9l9 4v-9z" fill="#e9eef5"/><path d="M40 14v9l-9 4v-9z" fill="#d6dde8"/><circle cx="36" cy="36" r="5" fill="#ff7eb3"/>'],
  fruit:['#ffe0dc','<path d="M24 14c-4-3-14-2-14 10 0 9 6 17 11 17 2 0 2-1 3-1s1 1 3 1c5 0 11-8 11-17 0-12-10-13-14-10z" fill="#e84545"/><path d="M17 20c-1 3-1 7 0 10" stroke="#ff8a80" stroke-width="2.4" stroke-linecap="round"/><path d="M24 14c0-4 1-7 3-9" stroke="#7a4a22" stroke-width="2" stroke-linecap="round"/><path d="M26 9c3-4 8-4 10-2-3 3-7 4-10 2z" fill="#3cb55e"/>'],
  chili:['#ffe0d6','<path d="M13 15c5 1 8 5 9 11 2 9 8 14 16 15-11 3-22-3-25-14-1-5-1-9 0-12z" fill="#e53935"/><path d="M15 19c1 6 4 12 10 16" stroke="#ff8a80" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M13 15c-1-4 1-8 5-10" stroke="#3a9a4a" stroke-width="3" stroke-linecap="round" fill="none"/>'],
  drink:['#f1e4d8','<path d="M11 16h22l-3 24a3 3 0 0 1-3 3H17a3 3 0 0 1-3-3z" fill="#fff" stroke="#e0cdbb" stroke-width="1.2"/><path d="M12.5 22h19l-2 15H14.5z" fill="#8b5a3c"/><path d="M33 20h3a5 5 0 0 1 0 10h-4" stroke="#e0cdbb" stroke-width="3" fill="none"/><path d="M19 11c0-3 3-3 3-6M25 11c0-3 3-3 3-6" stroke="#c9b7a6" stroke-width="2" stroke-linecap="round" fill="none"/>'],
  clean:['#d3f5f3','<path d="M18 16h12l2 26H16z" fill="#2fc0c0"/><rect x="19" y="24" width="10" height="9" rx="2" fill="#fff" opacity=".85"/><path d="M20 9h9v7H20z" fill="#4a5568"/><path d="M29 10h8l-2 4h-6" fill="#4a5568"/><circle cx="40" cy="10" r="1.2" fill="#8fe3e3"/><circle cx="42" cy="14" r="1.2" fill="#8fe3e3"/><circle cx="41" cy="6" r="1.2" fill="#8fe3e3"/>'],
  bag:['#ffe6d6','<path d="M10 17h28l-2 24a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2z" fill="#ff7a45"/><path d="M17 17v-4a7 7 0 0 1 14 0v4" stroke="#c9531f" stroke-width="2.6" fill="none"/><path d="M10 17h28l-.4 5H10.4z" fill="#ff9a6c"/><circle cx="17" cy="21" r="1.6" fill="#c9531f"/><circle cx="31" cy="21" r="1.6" fill="#c9531f"/>'],
  tag:['#ffe6d6','<path d="M24 6h16v16L22 40a3 3 0 0 1-4 0L8 30a3 3 0 0 1 0-4z" fill="#ff5b22"/><circle cx="33" cy="13" r="3" fill="#fff"/><path d="M16 26l8-8M20 30l8-8" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".7"/>'],
}

// Pick an icon from the item's Malay name and category, e.g. "AYAM BERSIH" -> chicken.
export function iconFor(name, category = '') {
  const n = `${name} ${category}`.toUpperCase()
  if (/AYAM/.test(n) && !/TELUR|SARDIN|SANTAN|KICAP/.test(n)) return 'chicken'
  if (/TELUR/.test(n)) return 'egg'
  if (/BERAS/.test(n) && !/CERELAC/.test(n)) return 'rice'
  if (/IKAN|UDANG|SOTONG|KETAM|BAHAN LAUT|SARDIN/.test(n)) return 'fish'
  if (/DAGING|KAMBING|LEMBU|KERBAU/.test(n)) return 'meat'
  if (/BAWANG/.test(n)) return 'onion'
  if (/MINYAK/.test(n)) return 'oil'
  if (/SUSU|MILO|KRIMER|CERELAC|LACTOGEN|DUMEX|ANMUM/.test(n)) return 'milk'
  if (/GULA|GARAM|TEPUNG/.test(n)) return 'sugar'
  if (/CILI/.test(n)) return 'chili'
  if (/BUAH|NENAS|PISANG|ANGGUR|EPAL|TEMBIKAI|BETIK|LIMAU|OREN/.test(n)) return 'fruit'
  if (/KOPI|TEH|MINUMAN|MINUM/.test(n)) return 'drink'
  if (/SAYUR|KUBIS|KOBIS|BROKOLI|KAILAN|SALAD|SADERI|TAUGE|BENDI|LABU|PETOLA|CENDAWAN|TOMATO|KENTANG|HALIA|LOBAK|SAWI|KANGKUNG|TIMUN|KELAPA|BAYAM|TERUNG|KACANG/.test(n)) return 'veg'
  if (/KEBERSIHAN|PENJAGAAN|SABUN|LAMPIN/.test(n)) return 'clean'
  return 'bag'
}

// The icon on a soft tile in its own colour (dimmed in dark mode by --tile-mix).
export function Icon({ k, className = 'ic' }) {
  const [tint, art] = ICONS[k] ?? ICONS.bag
  return (
    <span className={`${className} tile`} style={{ '--t': tint }}>
      <svg viewBox="0 0 48 48" aria-hidden="true" dangerouslySetInnerHTML={{ __html: art }} />
    </span>
  )
}

export const ItemIcon = ({ name, category, className }) => <Icon k={iconFor(name, category)} className={className} />