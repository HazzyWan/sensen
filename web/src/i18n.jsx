import { createContext, useContext, useEffect, useState } from 'react'

// Every piece of text the app shows, in English and Bahasa Melayu.
// A value is either a string with {placeholders}, or a function for text that
// needs logic (plurals) or formatting (bold).

const en = {
  // App
  choose: 'Pick your area above to see prices near you.',
  apiError: 'Could not reach the server: {e}',
  networkError: 'No connection, and this page was not saved yet. Try again when you are back online.',
  offline: 'You are offline. Showing the prices you last loaded.',
  footer: 'Prices from PriceCatcher by KPDN and DOSM (CC BY 4.0), checked in person by officers.',
  overviewTitle: 'Grocery prices in {d}',
  overviewSub: '{n} shops checked · week of {w}. Search on the left, or pick an item to see its price history.',
  // Header
  hello: 'What are you buying today?',
  weekOf: 'Week of {w}',
  chooseDistrict: 'Choose your area',
  searchPh: 'Search chicken, telur, beras…',
  searchAria: 'Search items',
  districtAria: 'Your area',
  areaSearchPh: 'Type your town, e.g. Subang',
  areaNone: 'No area matches “{q}”.',
  basketAria: 'My basket, {n} items',
  // Search
  typeMore: 'Type at least 2 letters.',
  searching: 'Searching…',
  noResults: 'Nothing found for “{q}” in {d}. Try another word in English or BM.',
  // Labels
  Low: 'Low', Normal: 'Normal', High: 'High',
  // Dashboard
  lowTitle: 'Low this week',
  lowSub: 'Below their usual price',
  lowNone: 'No items are below their usual range this week.',
  belowUsual: '{p}% below usual',
  moversTitle: 'Biggest moves this week',
  moversFallback: '{a} (not enough data for {d})',
  goingUp: 'Going up',
  comingDown: 'Coming down',
  nothingMoved: 'Nothing moved much.',
  storesTitle: 'Cheapest shops in {d}',
  storesSub: 'vs the usual price here',
  storesNone: 'Not enough shops with prices here yet.',
  storeMeta: '{n} items · cheapest on {c}',
  usual: 'Usual',
  cheaper: '{p}% cheaper',
  dearer: '{p}% dearer',
  // Item
  back: 'Back',
  overviewOf: 'Overview of {d}',
  loading: 'Loading…',
  cheapestIn: 'CHEAPEST IN {d}',
  shopsHavePrice: '{n} shops have a recent price · typical here {p}',
  noFresh: 'No shop in {d} has a price from the last 2 weeks.',
  sayLow: 'Cheaper than usual right now. A good week to buy.',
  sayNormal: 'About the usual price.',
  sayHigh: 'Dearer than usual right now. Buy less or wait if you can.',
  labelDetail: '{p} this week, usually {lo} to {hi}',
  comparedAcross: ' (compared across {r})',
  priceHistory: 'Price over 6 months',
  wholeRegion: 'All of {r}',
  cheapestShops: 'Cheapest shops',
  inArea: 'in {d}',
  bestPrice: 'Best price',
  addBasket: '+ Add to basket',
  inBasket: '✓ In your basket · Remove',
  basketFull: 'Basket is full ({n} items)',
  // Chart
  usualRange: 'usual range',
  chartRead: (v) => <><b>{v.p}</b> week of {v.w} · {v.n} shops</>,
  // Basket
  myBasket: 'My basket',
  itemCount: (v) => `${v.n} item${v.n === 1 ? '' : 's'}`,
  clearAll: 'Clear all',
  basketEmpty: 'Your basket is empty. Open any item and tap “Add to basket”.',
  removeAria: 'Remove {x}',
  comparing: 'Comparing shops…',
  noShop: 'No shop in {d} has recent prices for these items.',
  cheapestSingle: 'CHEAPEST SINGLE SHOP',
  noneHasAll: 'NO SHOP HAS EVERYTHING',
  hasAll: (v) => (v.n === 1 ? 'Has this item.' : `Has all ${v.n} items.`),
  hasSome: 'Has {f} of {n}. Missing: {m}.',
  mixTip: (v) => <>Buying each item wherever it is cheapest in {v.d} costs <b>{v.t}</b>, saving <b>{v.s}</b> if you don't mind visiting more than one shop.</>,
  allCompared: 'All shops compared',
  completeCount: '{c} of {n} shown have everything',
  allItems: (v) => (v.n === 1 ? 'Has it' : `All ${v.n} items`),
  missingN: 'Missing {k}: {m}',
  missingNote: "Shops missing items are listed after complete ones, so a lower total there isn't a cheaper trip.",
  // Units
  perKg: 'per kg',
}

const ms = {
  choose: 'Pilih kawasan anda di atas untuk melihat harga berdekatan.',
  apiError: 'Tidak dapat menghubungi pelayan: {e}',
  networkError: 'Tiada sambungan, dan halaman ini belum disimpan. Cuba lagi apabila talian kembali.',
  offline: 'Anda di luar talian. Memaparkan harga yang terakhir dimuatkan.',
  footer: 'Harga daripada PriceCatcher oleh KPDN dan DOSM (CC BY 4.0), disemak sendiri oleh pegawai.',
  overviewTitle: 'Harga barang runcit di {d}',
  overviewSub: '{n} kedai disemak · minggu {w}. Cari di sebelah kiri, atau pilih barang untuk melihat sejarah harganya.',
  hello: 'Nak beli apa hari ini?',
  weekOf: 'Minggu {w}',
  chooseDistrict: 'Pilih kawasan',
  searchPh: 'Cari ayam, telur, beras…',
  searchAria: 'Cari barang',
  districtAria: 'Kawasan anda',
  areaSearchPh: 'Taip bandar anda, cth. Subang',
  areaNone: 'Tiada kawasan sepadan dengan “{q}”.',
  basketAria: 'Bakul saya, {n} barang',
  typeMore: 'Taip sekurang-kurangnya 2 huruf.',
  searching: 'Mencari…',
  noResults: 'Tiada hasil untuk “{q}” di {d}. Cuba perkataan lain dalam BM atau English.',
  Low: 'Murah', Normal: 'Biasa', High: 'Mahal',
  lowTitle: 'Murah minggu ini',
  lowSub: 'Di bawah harga biasa',
  lowNone: 'Tiada barang di bawah harga biasa minggu ini.',
  belowUsual: '{p}% bawah biasa',
  moversTitle: 'Perubahan harga terbesar minggu ini',
  moversFallback: '{a} (data {d} tidak mencukupi)',
  goingUp: 'Naik',
  comingDown: 'Turun',
  nothingMoved: 'Tiada perubahan ketara.',
  storesTitle: 'Kedai paling murah di {d}',
  storesSub: 'berbanding harga biasa di sini',
  storesNone: 'Belum cukup kedai yang ada harga di sini.',
  storeMeta: '{n} barang · paling murah untuk {c}',
  usual: 'Biasa',
  cheaper: '{p}% lebih murah',
  dearer: '{p}% lebih mahal',
  back: 'Kembali',
  overviewOf: 'Gambaran {d}',
  loading: 'Memuatkan…',
  cheapestIn: 'PALING MURAH DI {d}',
  shopsHavePrice: '{n} kedai ada harga terkini · biasa di sini {p}',
  noFresh: 'Tiada kedai di {d} yang ada harga dalam 2 minggu lepas.',
  sayLow: 'Lebih murah daripada biasa sekarang. Minggu yang baik untuk beli.',
  sayNormal: 'Lebih kurang harga biasa.',
  sayHigh: 'Lebih mahal daripada biasa sekarang. Beli sedikit atau tunggu jika boleh.',
  labelDetail: '{p} minggu ini, biasanya {lo} hingga {hi}',
  comparedAcross: ' (dibanding seluruh {r})',
  priceHistory: 'Harga 6 bulan lepas',
  wholeRegion: 'Seluruh {r}',
  cheapestShops: 'Kedai paling murah',
  inArea: 'di {d}',
  bestPrice: 'Harga terbaik',
  addBasket: '+ Masuk bakul',
  inBasket: '✓ Dalam bakul · Buang',
  basketFull: 'Bakul penuh ({n} barang)',
  usualRange: 'julat biasa',
  chartRead: (v) => <><b>{v.p}</b> minggu {v.w} · {v.n} kedai</>,
  myBasket: 'Bakul saya',
  itemCount: (v) => `${v.n} barang`,
  clearAll: 'Kosongkan',
  basketEmpty: 'Bakul anda kosong. Buka mana-mana barang dan tekan “Masuk bakul”.',
  removeAria: 'Buang {x}',
  comparing: 'Membandingkan kedai…',
  noShop: 'Tiada kedai di {d} yang ada harga terkini untuk barang-barang ini.',
  cheapestSingle: 'SATU KEDAI PALING MURAH',
  noneHasAll: 'TIADA KEDAI ADA SEMUA',
  hasAll: (v) => (v.n === 1 ? 'Ada barang ini.' : `Ada kesemua ${v.n} barang.`),
  hasSome: 'Ada {f} daripada {n}. Tiada: {m}.',
  mixTip: (v) => <>Beli setiap barang di kedai paling murah di {v.d}: <b>{v.t}</b>, jimat <b>{v.s}</b> jika anda tidak kisah pergi ke lebih dari satu kedai.</>,
  allCompared: 'Perbandingan semua kedai',
  completeCount: '{c} daripada {n} ada semua barang',
  allItems: (v) => (v.n === 1 ? 'Ada' : `Kesemua ${v.n} barang`),
  missingN: 'Tiada {k}: {m}',
  missingNote: 'Kedai yang tiada sesetengah barang disenaraikan selepas kedai yang lengkap, jadi jumlah yang lebih rendah di situ bukan bermakna lebih jimat.',
  perKg: 'sekilo',
}

const DICTS = { en, ms }
const KEY = 'sensen.lang'

// First visit: follow the phone's language. After that, remember the choice.
const initial = () => {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'en' || saved === 'ms') return saved
  } catch { /* ignore */ }
  return navigator.language?.toLowerCase().startsWith('ms') ? 'ms' : 'en'
}

const LangContext = createContext(null)

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(initial)

  useEffect(() => { document.documentElement.lang = lang }, [lang])

  const setLang = (l) => {
    setLangState(l)
    try { localStorage.setItem(KEY, l) } catch { /* still switches, just not remembered */ }
  }

  // t('cheaper', { p: 7.2 }) -> "7.2% cheaper" or "7.2% lebih murah"
  const t = (key, vars = {}) => {
    const entry = DICTS[lang][key] ?? en[key] ?? key
    if (typeof entry === 'function') return entry(vars)
    return entry.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`)
  }

  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>
}

export const useLang = () => useContext(LangContext)