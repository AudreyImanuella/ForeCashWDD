// Parser teks hasil OCR struk belanja Indonesia.
// Murni (tanpa import dari proyek) supaya bisa diuji dengan `npm test`.
// Tugasnya: dari teks mentah OCR, cari total bayar, tanggal, nama toko, dan tebakan kategori.

export type HasilStruk = {
  /** total bayar; null kalau tidak ketemu */
  nominal: number | null
  /** 'tinggi' = ketemu di baris TOTAL/JUMLAH; 'rendah' = hanya tebakan angka terbesar */
  yakin: 'tinggi' | 'rendah' | 'tidak'
  /** YYYY-MM-DD; null kalau tidak ketemu atau tidak masuk akal */
  tanggal: string | null
  /** nama toko (baris atas struk); null kalau tidak ketemu */
  toko: string | null
  /** nama kategori pengeluaran yang cocok dengan kategori bawaan, atau null */
  kategori: string | null
}

const BULAN: Record<string, number> = {
  jan: 1, januari: 1, feb: 2, februari: 2, mar: 3, maret: 3, apr: 4, april: 4, mei: 5, may: 5,
  jun: 6, juni: 6, jul: 7, juli: 7, agu: 8, ags: 8, agt: 8, agustus: 8, aug: 8,
  sep: 9, sept: 9, september: 9, okt: 10, oktober: 10, oct: 10, nov: 11, november: 11, des: 12, desember: 12, dec: 12,
}

/** Baris yang berisi angka BUKAN total belanja (uang yang dibayarkan, kembalian, potongan, pajak, dll). */
const BUKAN_TOTAL = /\b(tunai|cash|kembali\w*|change|diskon|disc\w*|potongan|hemat|ppn|pajak|tax|service|servis|poin|point|saldo|voucher|promo|qty|item|barang|pcs)\b/i
/** Baris yang menandakan total yang dibayar. Urutan = prioritas (paling atas paling dipercaya). */
const KATA_TOTAL: RegExp[] = [
  /grand\s*total/i,
  /total\s*(bayar|belanja|tagihan|akhir|pembayaran|harus)/i,
  /(amount|total)\s*due/i,
  /net\s*total/i,
  /\btotal\b(?!\s*(item|qty|barang|pcs|disc|diskon|hemat|ppn|pajak|tax))/i,
  /\bjumlah\b(?!\s*(item|qty|barang|pcs))/i,
  /\btagihan\b/i,
  /\bsub\s*total\b/i,
]

const MIN_NOMINAL = 500
const MAX_NOMINAL = 99_999_999

/** Rapikan salah baca OCR di dalam angka: O→0, l/I→1, S→5 hanya bila token lainnya angka. */
function perbaikiToken(tok: string): string {
  if (!/\d/.test(tok)) return tok
  if (!/^[\dOolISs.,]+$/.test(tok)) return tok
  return tok.replace(/[Oo]/g, '0').replace(/[lI]/g, '1').replace(/[Ss]/g, '5')
}

/** Ubah "45.000", "45.000,00", "45,000", "Rp45000" menjadi angka rupiah. null kalau bukan angka. */
export function angkaRupiah(s: string): number | null {
  let t = s.replace(/rp\.?/gi, '').replace(/\s/g, '').replace(/[^\d.,]/g, '')
  if (!/\d/.test(t)) return null
  // pecahan di belakang (",00" / ".00" / ",50") dibuang: rupiah dibulatkan
  const dec = t.match(/[.,](\d{1,2})$/)
  if (dec && /[.,]/.test(t.slice(0, -dec[0].length))) t = t.slice(0, -dec[0].length) // ada pemisah ribuan lain: ini desimal
  else if (dec && dec[1].length === 2 && !/^\d{1,3}([.,]\d{3})+$/.test(t)) t = t.slice(0, -dec[0].length) // "45,00"
  t = t.replace(/[.,]/g, '')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** Semua kandidat angka dalam satu baris, urut dari kiri ke kanan. */
function angkaDalamBaris(baris: string): { nilai: number; berpemisah: boolean }[] {
  const hasil: { nilai: number; berpemisah: boolean }[] = []
  const tokens = baris.split(/\s+/).map(perbaikiToken)
  const gabung = tokens.join(' ')
  // pola: Rp opsional + digit dengan pemisah ribuan, atau digit polos
  const re = /(?:rp\.?\s*)?\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|(?:rp\.?\s*)?\d+(?:[.,]\d{1,2})?/gi
  for (const m of gabung.matchAll(re)) {
    const n = angkaRupiah(m[0])
    if (n == null) continue
    hasil.push({ nilai: n, berpemisah: /[.,]\d{3}/.test(m[0]) || /^rp/i.test(m[0]) })
  }
  return hasil
}

function bersihBaris(teks: string): string[] {
  return teks.split(/\r?\n/).map((b) => b.replace(/\s+/g, ' ').trim()).filter(Boolean)
}

function cariTotal(baris: string[]): { nominal: number | null; yakin: HasilStruk['yakin'] } {
  const layak = (n: number) => n >= MIN_NOMINAL && n <= MAX_NOMINAL

  // 1) baris yang memuat kata TOTAL dst. Angka bisa ada di baris itu atau baris berikutnya (kolom terpisah).
  for (const pola of KATA_TOTAL) {
    const kandidat: number[] = []
    baris.forEach((b, i) => {
      if (!pola.test(b)) return
      if (BUKAN_TOTAL.test(b.replace(pola, ''))) return
      let angka = angkaDalamBaris(b).filter((a) => layak(a.nilai))
      if (!angka.length && baris[i + 1] && !BUKAN_TOTAL.test(baris[i + 1]) && !KATA_TOTAL.some((p) => p.test(baris[i + 1]))) {
        angka = angkaDalamBaris(baris[i + 1]).filter((a) => layak(a.nilai))
      }
      if (angka.length) kandidat.push(angka[angka.length - 1].nilai) // angka paling kanan = nilai
    })
    if (kandidat.length) return { nominal: kandidat[kandidat.length - 1], yakin: 'tinggi' } // total biasanya di bagian bawah
  }

  // 2) tidak ada kata total: tebak angka terbesar yang berbentuk uang (ada pemisah ribuan / Rp)
  const semua = baris
    .filter((b) => !BUKAN_TOTAL.test(b))
    .flatMap((b) => angkaDalamBaris(b))
    .filter((a) => a.berpemisah && layak(a.nilai))
    .map((a) => a.nilai)
  if (semua.length) return { nominal: Math.max(...semua), yakin: 'rendah' }
  return { nominal: null, yakin: 'tidak' }
}

function tanggalValid(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000
  if (y < 2000 || m < 1 || m > 12 || d < 1 || d > 31) return null
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function cariTanggal(teks: string): string | null {
  let m: RegExpMatchArray | null
  // 2026-11-17
  if ((m = teks.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/))) {
    const t = tanggalValid(+m[1], +m[2], +m[3])
    if (t) return t
  }
  // 17/11/2026, 17-11-26, 17.11.2026
  for (const x of teks.matchAll(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})\b/g)) {
    const t = tanggalValid(+x[3], +x[2], +x[1])
    if (t) return t
  }
  // 17 Nov 2026, 17 November 26
  for (const x of teks.matchAll(/\b(\d{1,2})\s*([A-Za-z]{3,9})\.?\s*(\d{2}|\d{4})\b/g)) {
    const bln = BULAN[x[2].toLowerCase()]
    if (!bln) continue
    const t = tanggalValid(+x[3], bln, +x[1])
    if (t) return t
  }
  return null
}

const BUKAN_TOKO = /(struk|nota|receipt|invoice|kasir|cashier|npwp|telp|tel\b|phone|hp\b|wa\b|jl\.?|jalan|alamat|www\.|http|@|terima kasih|thank|selamat datang|welcome|no\.?\s*\d|\d{2}[-/.]\d{2}[-/.]\d{2,4})/i

function cariToko(baris: string[]): string | null {
  for (const b of baris.slice(0, 7)) {
    const huruf = (b.match(/[A-Za-z]/g) ?? []).length
    const angka = (b.match(/\d/g) ?? []).length
    if (huruf < 3 || angka > huruf || BUKAN_TOKO.test(b)) continue
    const bersih = b.replace(/[^A-Za-z0-9&'.\- ]/g, ' ').replace(/\s+/g, ' ').trim()
    if (bersih.length < 3) continue
    return judulKata(bersih).slice(0, 80)
  }
  return null
}

function judulKata(s: string): string {
  // "INDOMARET CIPETE" -> "Indomaret Cipete"; yang sudah campur huruf besar-kecil dibiarkan
  if (s !== s.toUpperCase()) return s
  return s.toLowerCase().replace(/(^|\s)([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase())
}

const KATEGORI: { nama: string; kata: RegExp }[] = [
  { nama: 'Makan & Minum', kata: /\b(resto|restoran|warung|warteg|kantin|cafe|caf[eé]|kopi|coffee|bakso|mie|mi\s?ayam|nasi|ayam|geprek|sate|soto|pizza|burger|kfc|mcd|mcdonald|starbucks|janji jiwa|kenangan|chatime|boba|teh|jus|bakery|roti|donat|dunkin|makan|minum|food|kitchen|bubur|seblak|martabak)/i },
  { nama: 'Transportasi', kata: /\b(grab|gojek|go-?jek|gocar|goride|maxim|indrive|bensin|pertamina|shell|bp\b|spbu|pertalite|pertamax|parkir|tol\b|e-?toll|transjakarta|krl|mrt|lrt|kai\b|tiket kereta|ojek)/i },
  { nama: 'Kebutuhan Kuliah', kata: /\b(fotokopi|photocopy|print|cetak|atk|alat tulis|buku|gramedia|toko buku|kertas|pulpen|stationery|jilid|materai|kuota|paket data)/i },
  { nama: 'Hiburan', kata: /\b(bioskop|cinema|xxi|cgv|netflix|spotify|steam|game|karaoke|tiket|konser|youtube|disney|vidio|timezone)/i },
  { nama: 'Kos / Sewa', kata: /\b(kos\b|kost|sewa|kontrakan|listrik|token pln|air pdam)/i },
]

function tebakKategori(teks: string): string | null {
  for (const k of KATEGORI) if (k.kata.test(teks)) return k.nama
  return null
}

/** Baca teks hasil OCR dan ambil nominal, tanggal, toko, kategori. */
export function bacaTeksStruk(teks: string): HasilStruk {
  const baris = bersihBaris(teks)
  const { nominal, yakin } = cariTotal(baris)
  return {
    nominal,
    yakin,
    tanggal: cariTanggal(teks),
    toko: cariToko(baris),
    kategori: tebakKategori(teks),
  }
}
