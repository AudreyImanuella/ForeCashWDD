/** Format rupiah, contoh 'Rp 1.250.000' (sama dengan rupiah() di PHP). */
export function rupiah(n: number | string | null | undefined): string {
  const v = Math.round(Number(n) || 0)
  const s = Math.abs(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return (v < 0 ? '-Rp ' : 'Rp ') + s
}

/** Nama depan, contoh 'Momo Mahasiswa' -> 'Momo'. */
export function namaDepan(nama: string): string {
  return nama.trim().split(/\s+/)[0] || nama
}

/**
 * Baca nominal yang diketik orang Indonesia: '25.000', 'Rp 1.250.000', '25000', '12.500,50'.
 * Titik = pemisah ribuan, koma = desimal. Hasil NaN kalau tidak ada angka.
 */
export function bacaNominal(s: string | null | undefined): number {
  const t = String(s ?? '').replace(/rp/gi, '').replace(/\s/g, '')
  if (!/\d/.test(t)) return NaN
  const [bulat, desimal] = t.split(',')
  const angka = bulat.replace(/\./g, '') + (desimal !== undefined ? '.' + desimal : '')
  return /^-?\d+(\.\d+)?$/.test(angka) ? Number(angka) : NaN
}

/** Tambah titik ribuan pada deretan digit: '1250000' -> '1.250.000'. */
export function ribuan(digit: string): string {
  const d = digit.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
  return d.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}
