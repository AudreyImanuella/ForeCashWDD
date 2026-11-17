// Hitungan fitur Rencana: anggaran per kategori dan target tabungan.
// Murni (tanpa ambil data) supaya bisa diuji di tests/rencana.test.ts.
import { selisihHari } from './tanggal.ts'

export type StatusAnggaran = 'aman' | 'hampir' | 'lewat'

export type BarisAnggaran = {
  category_id: number
  nama: string
  batas: number
  terpakai: number
  sisa: number
  /** persen terpakai, 0–100 (dibatasi) */
  persen: number
  status: StatusAnggaran
}

/** Bandingkan anggaran dengan pengeluaran bulan ini. "Hampir" = sudah terpakai ≥ 80%. */
export function ringkasAnggaran(
  anggaran: { category_id: number; nama: string; batas: number }[],
  terpakaiPerKategori: Record<number, number>,
): BarisAnggaran[] {
  return anggaran.map((a) => {
    const terpakai = terpakaiPerKategori[a.category_id] ?? 0
    const rasio = a.batas > 0 ? terpakai / a.batas : 0
    const status: StatusAnggaran = terpakai > a.batas ? 'lewat' : rasio >= 0.8 ? 'hampir' : 'aman'
    return { ...a, terpakai, sisa: a.batas - terpakai, persen: Math.min(100, Math.round(rasio * 100)), status }
  })
}

export type InfoTarget = {
  persen: number
  kurang: number
  tercapai: boolean
  /** saran setoran per minggu supaya tercapai sebelum tenggat (null kalau tidak ada tenggat / sudah tercapai) */
  perMinggu: number | null
  /** tenggat sudah lewat tapi belum tercapai */
  telat: boolean
}

export function infoTarget(t: { target: number; terkumpul: number; tenggat: string | null }, hariIni: string): InfoTarget {
  const kurang = Math.max(0, t.target - t.terkumpul)
  const tercapai = kurang === 0
  const persen = Math.min(100, Math.round((t.terkumpul / t.target) * 100))
  let perMinggu: number | null = null
  let telat = false
  if (!tercapai && t.tenggat) {
    const hari = selisihHari(hariIni, t.tenggat)
    if (hari <= 0) telat = true
    else perMinggu = Math.ceil(kurang / Math.max(1, Math.ceil(hari / 7)) / 1000) * 1000
  }
  return { persen, kurang, tercapai, perMinggu, telat }
}
