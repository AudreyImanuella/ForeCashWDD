// ForeCash Assistant: chatbot berbasis aturan (tanpa AI API).
// Port dari jawab_bot() di php-version/api/chatbot.php.
// Cara kerja: 1) cari kata kunci di pertanyaan -> tentukan "intent"
//             2) ambil data user yang dibutuhkan intent itu -> susun jawaban.
// Format jawaban: **tebal**, [teks link](/halaman), dan baris baru (\n).
// Bagian ini murni (tanpa database) dan diuji di tests/chatbot.test.ts.
import { rupiah } from './format.ts'
import { tgl } from './tanggal.ts'
import type { Forecast } from './forecast.ts'

export type Intent = 'saldo' | 'habis' | 'tips' | 'burn' | 'utang' | 'badge' | 'transfer' | 'struk' | 'catat' | 'sapa' | 'tidak_paham'

/**
 * Daftar kata kunci per intent. Urutan = prioritas (yang atas didahulukan, sama seperti versi PHP).
 * "lemah" = intent umum yang kalah kalau ada intent lain yang cocok (mis. "cara hemat" -> tips, bukan catat).
 */
const ATURAN: { intent: Intent; kata: string[]; lemah?: boolean }[] = [
  { intent: 'saldo', kata: ['saldo', 'uang aku', 'uangku', 'duit'] },
  { intent: 'habis', kata: ['habis', 'kapan', 'runway', 'cukup', 'aman'] },
  { intent: 'tips', kata: ['hemat', 'tips', 'saran', 'boros', 'kategori', 'paling banyak'] },
  { intent: 'burn', kata: ['burn', 'rata-rata', 'per hari', 'harian'] },
  { intent: 'utang', kata: ['utang', 'piutang', 'pinjam', 'nagih', 'patungan'] },
  { intent: 'badge', kata: ['badge', 'level', 'poin', 'streak', 'pencapaian'] },
  { intent: 'transfer', kata: ['transfer', 'wallet', 'dompet', 'gopay', 'bca', 'e-wallet'] },
  { intent: 'struk', kata: ['struk', 'foto', 'bukti'] },
  { intent: 'catat', kata: ['catat', 'tambah', 'input', 'cara'], lemah: true },
  { intent: 'sapa', kata: ['halo', 'hai', 'hi', 'pagi', 'siang', 'malam'], lemah: true },
]

/**
 * Cocok per KATA, bukan per potongan huruf:
 * - kata pendek (maks. 3 huruf, mis. "hi", "bca") harus sama persis -> "hiburan" tidak lagi dianggap "hi"
 * - kata lain boleh diikuti imbuhan -> "uangku", "utangku", "dihemat" tetap dikenali
 */
function cocokKata(q: string, kata: string): boolean {
  const k = kata.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = kata.length <= 3 ? new RegExp(`(^|[^a-z0-9])${k}($|[^a-z0-9])`) : new RegExp(`(^|[^a-z0-9])${k}`)
  return re.test(q)
}

/** Semua intent yang cocok, urut prioritas. Kosong = tidak ada yang cocok. */
export function semuaIntent(teks: string): Intent[] {
  const q = teks.toLowerCase()
  const ada = (kata: string[]) => kata.some((k) => cocokKata(q, k))
  const hasil: { intent: Intent; lemah: boolean }[] = []

  for (const a of ATURAN) {
    if (!ada(a.kata)) continue
    // "saldo cukup gak?" itu pertanyaan prediksi, bukan cek saldo (aturan lama tetap dipakai)
    if (a.intent === 'saldo' && ada(['habis', 'kapan', 'cukup'])) continue
    // sapaan hanya untuk pesan pendek ("pengeluaran malam hari" bukan sapaan)
    if (a.intent === 'sapa' && q.trim().split(/\s+/).length > 4) continue
    hasil.push({ intent: a.intent, lemah: !!a.lemah })
  }
  const kuat = hasil.filter((h) => !h.lemah)
  return (kuat.length ? kuat : hasil).map((h) => h.intent)
}

/** Intent utama (yang paling atas). Dipakai kalau chatbot menjawab dengan aturan. */
export function deteksiIntent(teks: string): Intent {
  return semuaIntent(teks)[0] ?? 'tidak_paham'
}

/** Data yang dipakai untuk menjawab. Hanya bagian yang dibutuhkan intent yang diisi. */
export type DataBot = {
  namaDepan: string
  f?: Forecast
  wallets?: { nama: string; saldo: number }[]
  /** pengeluaran terbesar bulan ini */
  kategoriTeratas?: { kategori: string; total: number; totalKeluar: number } | null
  utang?: { piutangTotal: number; piutangN: number; utangTotal: number; utangN: number }
  gamify?: { level: number; levelNama: string; poin: number; streak: number; badgeDapat: number; badgeTotal: number }
  /** hanya diisi untuk jawaban AI: perbandingan bulan ini vs bulan lalu */
  bulanan?: {
    masuk: number
    keluar: number
    keluarBulanLalu: number
    perKategori: { kategori: string; total: number }[]
    perKategoriBulanLalu: { kategori: string; total: number }[]
  }
}

const TIPS: Record<string, string> = {
  'Makan & Minum': 'Coba bawa bekal 2–3 kali seminggu atau batasi jajan kopi.',
  Transportasi: 'Gabungkan perjalanan atau pakai transportasi umum untuk rute rutin.',
  Hiburan: 'Tentukan jatah hiburan per minggu dan catat setiap kali dipakai.',
  'Kos / Sewa': 'Ini biaya tetap, jadi fokuskan penghematan di kategori lain.',
}

export function buatJawaban(intent: Intent, d: DataBot): string {
  switch (intent) {
    case 'saldo': {
      const baris = (d.wallets ?? []).map((w) => `• ${w.nama}: ${rupiah(w.saldo)}`)
      return `Total saldomu **${rupiah(d.f?.saldo ?? 0)}**.\n${baris.join('\n')}`
    }
    case 'habis': {
      const f = d.f!
      if (f.burn <= 0) return 'Belum ada pengeluaran yang tercatat, jadi tanggal saldo habis belum bisa diprediksi.'
      let s = `Dengan pengeluaran rata-rata **${rupiah(f.burn)}/hari**, saldomu diperkirakan habis **${tgl(f.habis!)}** (${f.runway} hari lagi).`
      if (f.next) s += ` Pemasukan berikutnya ${tgl(f.next.tanggal_perkiraan)}, jadi statusmu **${f.status.toUpperCase()}**.`
      if (f.status !== 'aman' && f.batasAman) s += ` Supaya aman, batasi pengeluaran maksimal **${rupiah(f.batasAman)}/hari**.`
      return s
    }
    case 'tips': {
      const k = d.kategoriTeratas
      if (!k) return 'Belum ada pengeluaran bulan ini. Mulai catat dulu, nanti aku kasih saran berdasarkan datamu.'
      const pct = Math.round((k.total / k.totalKeluar) * 100)
      const tips = TIPS[k.kategori] ?? 'Coba tetapkan batas khusus untuk kategori ini setiap minggu.'
      return `Bulan ini pengeluaran terbesarmu di **${k.kategori}**: ${rupiah(k.total)} (${pct}% dari total). ${tips}`
    }
    case 'burn': {
      const f = d.f!
      return `Burn rate-mu **${rupiah(f.burn)}/hari**, dihitung dari total pengeluaran ${f.hari} hari terakhir dibagi ${f.hari}. Transfer antar wallet tidak ikut dihitung.`
    }
    case 'utang': {
      const u = d.utang!
      if (u.piutangN + u.utangN === 0) return 'Tidak ada utang atau piutang yang belum lunas. Mantap!'
      return `Piutang (teman ke kamu): **${rupiah(u.piutangTotal)}** dari ${u.piutangN} catatan.\n` +
        `Utang (kamu ke teman): **${rupiah(u.utangTotal)}** dari ${u.utangN} catatan.\n` +
        'Kirim pengingat lewat menu [Utang & Patungan](/utang).'
    }
    case 'badge': {
      const g = d.gamify!
      return `Kamu di **Level ${g.level} · ${g.levelNama}** (${g.poin} poin), streak **${g.streak} hari**, dan sudah dapat ${g.badgeDapat} dari ${g.badgeTotal} badge. Lihat detail di [Pencapaian](/pencapaian).`
    }
    case 'transfer':
      return 'Untuk isi e-wallet dari rekening, catat sebagai **Transfer** di menu Transaksi. Cukup sekali catat, dan tidak dihitung sebagai pengeluaran sehingga burn rate tetap akurat.'
    case 'struk':
      return 'Saat mencatat transaksi, pilih **Foto struk** (JPG/PNG/WEBP, maks. 2 MB). Ikon struk akan muncul di riwayat dan bisa diklik untuk melihat fotonya.'
    case 'catat':
      return 'Buka menu [Transaksi](/transaksi#form), pilih jenis, isi nominal, kategori, dan tanggal, lalu Simpan. Wallet boleh dikosongkan, otomatis masuk ke "Utama".'
    case 'sapa':
      return `Halo ${d.namaDepan}! Mau cek saldo, kapan uang habis, atau minta tips hemat?`
    default:
      return 'Maaf, aku belum paham pertanyaan itu. Coba tanya soal **saldo**, **kapan uang habis**, **tips hemat**, **utang**, atau **pencapaian**.'
  }
}

/** Data apa saja yang perlu diambil untuk intent ini (supaya query ke database seperlunya). */
export function kebutuhanData(intent: Intent) {
  return {
    forecast: ['saldo', 'habis', 'burn', 'badge'].includes(intent),
    wallets: intent === 'saldo',
    laporan: intent === 'tips',
    utang: intent === 'utang',
    gamify: intent === 'badge',
  }
}

/** Untuk jawaban AI: ambil semua data sekaligus supaya pertanyaan bebas bisa dijawab. */
export const SEMUA_DATA = { forecast: true, wallets: true, laporan: true, utang: true, gamify: true }
