// Gamifikasi: streak, badge bertingkat, poin, level, tantangan mingguan.
// Badge didapat dari KEBIASAAN NYATA (hemat, patuh anggaran, menabung, patungan, melunasi),
// bukan sekadar membuka aplikasi. Setiap badge punya 3 tingkat: Perunggu, Perak, Emas.
// Fungsi gamify() murni (diuji di tests/gamify.test.ts); data diambil oleh ambilGamify().
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Status } from './forecast.ts'
import { hariIni as hariIniWib, hariKe, rentangBulan, selisihHari, tambahHari } from './tanggal.ts'

export const LEVELS: [number, string][] = [
  [0, 'Pemula'], [300, 'Hemat Muda'], [800, 'Pengatur Cerdas'], [1600, 'Master Budget'], [2800, 'Legenda ForeCash'],
]
export const TINGKAT = ['Belum', 'Perunggu', 'Perak', 'Emas'] as const
/** poin kumulatif per tingkat badge */
export const POIN_TINGKAT = [0, 50, 150, 350]
export const BATAS_TANTANGAN = 200000

export type IkonBadge =
  | 'pencatat' | 'rajin' | 'hemat' | 'anggaran' | 'penabung' | 'rutin' | 'impian'
  | 'perencana' | 'patungan' | 'lingkaran' | 'bebas' | 'penagih' | 'pemindai'

export type Badge = {
  key: IkonBadge
  /** dipakai komponen ikon (nama sama dengan key) */
  icon: IkonBadge
  nama: string
  /** cara mendapatkannya */
  ket: string
  nilai: number
  ambang: [number, number, number]
  /** 0 = belum, 1 = perunggu, 2 = perak, 3 = emas */
  tingkat: number
  /** ambang tingkat berikutnya (null kalau sudah emas) */
  berikut: number | null
  /** kemajuan menuju tingkat berikutnya, 0–100 */
  persen: number
  satuan: 'rp' | 'angka'
  poin: number
  dapat: boolean
  /** untuk kompatibilitas tampilan lama */
  now: number
  max: number
}

export type Tantangan = {
  judul: string
  now: number
  max: number
  sisaHari: number
  /** 'maks' = jangan lewat dari max (makin kecil makin baik), 'min' = capai minimal max */
  jenis: 'maks' | 'min'
  satuan: 'rp' | 'hari'
  selesai: boolean
  gagal: boolean
}

export type GamifyInput = {
  hariIni: string
  /** semua tanggal yang ada transaksinya (boleh berulang) */
  tanggalTransaksi: string[]
  jumlahTransaksi: number
  batasHarian: number
  /** total pengeluaran per tanggal, minimal 30 hari terakhir */
  pengeluaranPerHari: Record<string, number>
  status: Status
  /** total pengeluaran kategori "Makan & Minum" sejak Senin minggu ini */
  makanMingguIni: number
  jumlahStruk?: number
  utangLunas?: number
  piutangLunas?: number
  patunganTerkirim?: number
  jumlahTeman?: number
  /** rencana pengeluaran + jadwal pemasukan yang pernah dibuat */
  jumlahRencana?: number
  totalSetoran?: number
  tanggalSetoran?: string[]
  targetTercapai?: number
  /** kategori yang masih di bawah anggaran bulan ini (dihitung mulai tanggal 7) */
  anggaranAman?: number
}

export type Gamify = {
  streak: number
  streakTerpanjang: number
  badges: Badge[]
  poin: number
  level: number
  levelNama: string
  prevPoin: number
  nextPoin: number | null
  nextNama: string | null
  tantangan: Tantangan
  /** badge yang paling dekat naik tingkat (pemicu "sedikit lagi!") */
  hampir: Badge | null
}

/** Berapa hari berturut-turut mencatat transaksi (boleh belum mencatat hari ini). */
export function hitungStreak(tanggal: string[], hariIni: string): number {
  const ada = new Set(tanggal)
  let d = ada.has(hariIni) ? hariIni : tambahHari(hariIni, -1)
  let n = 0
  while (ada.has(d)) {
    n++
    d = tambahHari(d, -1)
  }
  return n
}

/** Rekor streak terpanjang yang pernah dicapai. */
export function streakTerpanjang(tanggal: string[]): number {
  const urut = [...new Set(tanggal)].sort()
  let best = 0
  let jalan = 0
  for (let i = 0; i < urut.length; i++) {
    jalan = i > 0 && selisihHari(urut[i - 1], urut[i]) === 1 ? jalan + 1 : 1
    best = Math.max(best, jalan)
  }
  return best
}

/** Senin minggu ini (minggu dihitung Senin–Minggu, seperti 'monday this week' di PHP). */
export function seninMingguIni(hariIni: string): string {
  return tambahHari(hariIni, -(hariKe(hariIni) - 1))
}

/** Berapa minggu berturut-turut ada setoran tabungan (minggu ini boleh belum). */
export function mingguBeruntun(tanggal: string[], hariIni: string): number {
  const minggu = new Set(tanggal.map(seninMingguIni))
  let s = seninMingguIni(hariIni)
  if (!minggu.has(s)) s = tambahHari(s, -7)
  let n = 0
  while (minggu.has(s)) {
    n++
    s = tambahHari(s, -7)
  }
  return n
}

function buatBadge(key: IkonBadge, nama: string, ket: string, nilai: number, ambang: [number, number, number], satuan: Badge['satuan'] = 'angka'): Badge {
  const tingkat = ambang.filter((a) => nilai >= a).length
  const berikut = tingkat < 3 ? ambang[tingkat] : null
  const dari = tingkat > 0 ? ambang[tingkat - 1] : 0
  const persen = berikut === null ? 100 : Math.max(0, Math.min(99, Math.floor(((nilai - dari) / (berikut - dari)) * 100)))
  return {
    key, icon: key, nama, ket, nilai, ambang, tingkat, berikut, persen, satuan,
    poin: POIN_TINGKAT[tingkat], dapat: tingkat > 0, now: Math.min(nilai, berikut ?? ambang[2]), max: berikut ?? ambang[2],
  }
}

export function gamify(i: GamifyInput): Gamify {
  const streak = hitungStreak(i.tanggalTransaksi, i.hariIni)
  const terpanjang = Math.max(streak, streakTerpanjang(i.tanggalTransaksi))

  // hari hemat: hari dalam 30 hari terakhir yang pengeluarannya tidak melebihi batas harian
  let hariHemat = 0
  if (i.batasHarian > 0) {
    for (let k = 0; k < 30; k++) {
      if ((i.pengeluaranPerHari[tambahHari(i.hariIni, -k)] ?? 0) <= i.batasHarian) hariHemat++
    }
  }

  const badges: Badge[] = [
    buatBadge('pencatat', 'Pencatat', 'Jumlah transaksi yang kamu catat', i.jumlahTransaksi, [10, 50, 150]),
    buatBadge('rajin', 'Rajin Mencatat', 'Rekor mencatat berhari-hari tanpa putus', terpanjang, [3, 7, 30]),
    buatBadge('hemat', 'Hari Hemat', i.batasHarian > 0 ? 'Hari di bawah batas harian (30 hari terakhir)' : 'Atur batas harian dulu di menu Transaksi', hariHemat, [5, 15, 25]),
    buatBadge('anggaran', 'Patuh Anggaran', 'Kategori yang masih di bawah anggaran bulan ini', i.anggaranAman ?? 0, [1, 3, 5]),
    buatBadge('penabung', 'Penabung', 'Total setoran ke target tabungan', i.totalSetoran ?? 0, [100000, 500000, 2000000], 'rp'),
    buatBadge('rutin', 'Nabung Rutin', 'Minggu berturut-turut ada setoran tabungan', mingguBeruntun(i.tanggalSetoran ?? [], i.hariIni), [2, 4, 8]),
    buatBadge('impian', 'Impian Tercapai', 'Target tabungan yang berhasil tercapai', i.targetTercapai ?? 0, [1, 3, 5]),
    buatBadge('perencana', 'Perencana', 'Rencana pengeluaran & jadwal pemasukan yang dibuat', i.jumlahRencana ?? 0, [1, 5, 15]),
    buatBadge('patungan', 'Raja Patungan', 'Tagihan split bill yang dikirim ke teman ForeCash', i.patunganTerkirim ?? 0, [1, 5, 15]),
    buatBadge('lingkaran', 'Lingkaran Hemat', 'Teman yang tersambung di ForeCash', i.jumlahTeman ?? 0, [1, 3, 8]),
    buatBadge('bebas', 'Bebas Utang', 'Utang yang sudah kamu lunasi', i.utangLunas ?? 0, [1, 5, 10]),
    buatBadge('penagih', 'Penagih Andal', 'Piutang yang sudah dilunasi temanmu', i.piutangLunas ?? 0, [1, 5, 15]),
    buatBadge('pemindai', 'Pemindai Struk', 'Transaksi yang dilengkapi foto struk', i.jumlahStruk ?? 0, [1, 10, 30]),
  ]

  const poin = badges.reduce((s, b) => s + b.poin, 0) + Math.min(streak, 30) * 10
  let li = 0
  LEVELS.forEach(([min], idx) => { if (poin >= min) li = idx })
  const next = LEVELS[li + 1] ?? null

  // badge yang paling dekat naik tingkat
  const kandidat = badges.filter((b) => b.berikut !== null && b.nilai > 0 && !(b.key === 'hemat' && i.batasHarian <= 0))
  const hampir = kandidat.sort((a, b) => b.persen - a.persen)[0] ?? null

  return {
    streak, streakTerpanjang: terpanjang, badges, poin,
    level: li + 1, levelNama: LEVELS[li][1], prevPoin: LEVELS[li][0],
    nextPoin: next?.[0] ?? null, nextNama: next?.[1] ?? null,
    tantangan: tantanganMingguIni(i),
    hampir,
  }
}

/** Tantangan berganti tiap minggu (bergilir), supaya selalu ada hal baru untuk dikejar. */
export function tantanganMingguIni(i: GamifyInput): Tantangan {
  const senin = seninMingguIni(i.hariIni)
  const sisaHari = 7 - hariKe(i.hariIni)
  const giliran = Math.floor(Math.abs(selisihHari('2026-01-05', senin)) / 7) % 3 // 5 Jan 2026 = Senin

  // jumlah hari minggu ini yang ada catatannya / di bawah batas harian
  const hariMinggu = Array.from({ length: hariKe(i.hariIni) }, (_, k) => tambahHari(senin, k))
  const tanggal = new Set(i.tanggalTransaksi)
  const hariCatat = hariMinggu.filter((d) => tanggal.has(d)).length
  const hariHemat = hariMinggu.filter((d) => (i.pengeluaranPerHari[d] ?? 0) <= i.batasHarian).length

  if (giliran === 1 || (giliran === 2 && i.batasHarian <= 0)) {
    const max = 5
    return { judul: 'Catat transaksi minimal 5 hari minggu ini', now: hariCatat, max, sisaHari, jenis: 'min', satuan: 'hari', selesai: hariCatat >= max, gagal: hariCatat + sisaHari < max }
  }
  if (giliran === 2) {
    const max = 4
    return { judul: 'Belanja di bawah batas harian selama 4 hari minggu ini', now: hariHemat, max, sisaHari, jenis: 'min', satuan: 'hari', selesai: hariHemat >= max, gagal: hariHemat + sisaHari < max }
  }
  const lewat = i.makanMingguIni > BATAS_TANTANGAN
  return {
    judul: `Makan & minum minggu ini di bawah Rp ${BATAS_TANTANGAN.toLocaleString('id-ID')}`,
    now: i.makanMingguIni, max: BATAS_TANTANGAN, sisaHari, jenis: 'maks', satuan: 'rp',
    selesai: !lewat && sisaHari === 0, gagal: lewat,
  }
}

/** Ambil data dari Supabase lalu hitung gamifikasi. Tabel fitur baru yang belum ada dianggap kosong. */
export async function ambilGamify(supabase: SupabaseClient, uid: string, batasHarian: number, status: Status): Promise<Gamify> {
  const hari = hariIniWib()
  const senin = seninMingguIni(hari)
  const [awalBulan, akhirBulan] = rentangBulan(hari.slice(0, 7))
  const hitung = { count: 'exact' as const, head: true }

  const [tgl, jumlah, keluar30, debts, jadwal, makan, struk, teman, rencana, setoran, target, anggaran, keluarBulan] = await Promise.all([
    supabase.from('transactions').select('tanggal').eq('user_id', uid).order('tanggal', { ascending: false }).limit(2000),
    supabase.from('transactions').select('id', hitung).eq('user_id', uid),
    supabase.from('transactions').select('tanggal, nominal').eq('user_id', uid).eq('jenis', 'pengeluaran').gt('tanggal', tambahHari(hari, -30)),
    supabase.from('debts').select('arah, status, teman_id, pasangan_id').eq('user_id', uid),
    supabase.from('income_schedules').select('id', hitung).eq('user_id', uid),
    supabase.from('transactions').select('nominal, categories!inner(nama)').eq('user_id', uid).eq('jenis', 'pengeluaran')
      .gte('tanggal', senin).eq('categories.nama', 'Makan & Minum'),
    supabase.from('transactions').select('id', hitung).eq('user_id', uid).not('bukti', 'is', null),
    supabase.from('teman').select('id', hitung).eq('user_id', uid),
    supabase.from('rencana_pengeluaran').select('id', hitung).eq('user_id', uid),
    supabase.from('setoran_tabungan').select('nominal, tanggal').eq('user_id', uid),
    supabase.from('target_tabungan').select('id', hitung).eq('user_id', uid).not('tercapai_pada', 'is', null),
    supabase.from('anggaran').select('category_id, batas').eq('user_id', uid),
    supabase.from('transactions').select('category_id, nominal').eq('user_id', uid).eq('jenis', 'pengeluaran').gte('tanggal', awalBulan).lt('tanggal', akhirBulan),
  ])

  const perHari: Record<string, number> = {}
  for (const t of keluar30.data ?? []) perHari[t.tanggal] = (perHari[t.tanggal] ?? 0) + Number(t.nominal)

  // sebelum migrasi 000006, kolom teman_id belum ada -> ambil ulang tanpa kolom itu
  const d = (debts.error
    ? (await supabase.from('debts').select('arah, status').eq('user_id', uid)).data ?? []
    : debts.data ?? []) as { arah: string; status: string; teman_id?: string | null; pasangan_id?: number | null }[]

  // anggaran aman baru dihitung mulai tanggal 7 (awal bulan semua kategori pasti "aman")
  let anggaranAman = 0
  if (Number(hari.slice(8)) >= 7) {
    const pakai: Record<number, number> = {}
    for (const t of keluarBulan.data ?? []) if (t.category_id) pakai[t.category_id] = (pakai[t.category_id] ?? 0) + Number(t.nominal)
    anggaranAman = (anggaran.data ?? []).filter((a) => (pakai[a.category_id] ?? 0) <= Number(a.batas)).length
  }
  const set = setoran.data ?? []

  return gamify({
    hariIni: hari,
    tanggalTransaksi: (tgl.data ?? []).map((t) => t.tanggal),
    jumlahTransaksi: jumlah.count ?? 0,
    batasHarian,
    pengeluaranPerHari: perHari,
    status,
    makanMingguIni: (makan.data ?? []).reduce((s, t) => s + Number(t.nominal), 0),
    jumlahStruk: struk.count ?? 0,
    utangLunas: d.filter((x) => x.arah === 'utang' && x.status === 'lunas').length,
    piutangLunas: d.filter((x) => x.arah === 'piutang' && x.status === 'lunas').length,
    patunganTerkirim: d.filter((x) => x.arah === 'piutang' && x.teman_id && x.pasangan_id).length,
    jumlahTeman: teman.count ?? 0,
    jumlahRencana: (rencana.count ?? 0) + (jadwal.count ?? 0),
    totalSetoran: set.reduce((s, x) => s + Number(x.nominal), 0),
    tanggalSetoran: set.map((x) => x.tanggal),
    targetTercapai: target.count ?? 0,
    anggaranAman,
  })
}
