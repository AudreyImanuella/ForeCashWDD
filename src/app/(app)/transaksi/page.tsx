'use server'

import { wajibLogin } from '@/lib/auth'
import { ambilWallet, kategoriEmoji, type Jenis } from '@/lib/data'
import { rupiah } from '@/lib/format'
import { bulanDariParam, rentangBulan, tgl } from '@/lib/tanggal'
import TxForm from './components/TxForm'
import ScanStruk from './components/ScanStruk'
import TombolHapus from '@/components/TombolHapus'
import BatasHarianForm from './components/BatasHarianForm'
import KategoriSaya from './components/KategoriSaya'
import { hapusTransaksi, tambahTransaksi } from './actions'
import Flash from '@/components/Flash'
import Link from 'next/link'
import { Download, Pencil, ReceiptText } from 'lucide-react'

const KELAS: Record<string, string> = {
  pemasukan: 'bg-emerald-50 text-emerald-600',
  pengeluaran: 'bg-rose-50 text-rose-600',
  transfer: 'bg-sky-50 text-sky-600',
}

const WARNA: Record<string, string> = {
  pemasukan: 'text-emerald-600',
  pengeluaran: 'text-rose-600',
  transfer: 'text-sky-600',
}

const TANDA: Record<string, string> = {
  pemasukan: '+',
  pengeluaran: '-',
  transfer: '',
}

export default async function Page({ searchParams }: { searchParams: Promise<{ bulan?: string; ok?: string; jenis?: string }> }) {
  const sp = await searchParams
  const { supabase, profil } = await wajibLogin('mahasiswa')
  const uid = profil.id

  const bulan = bulanDariParam(sp.bulan)
  const rentang = rentangBulan(bulan)
  const awal = Array.isArray(rentang) ? rentang[0] : (rentang as { awal: string }).awal
  const akhir = Array.isArray(rentang) ? rentang[1] : (rentang as { akhir: string }).akhir

  const [walletsRes, kategoriRes, transaksiRes, totalHariIniRes] = await Promise.all([
    ambilWallet(supabase, uid),
    supabase.from('categories').select('*').or(`user_id.is.null,user_id.eq.${uid}`).order('nama'),
    supabase.from('transactions')
      .select('id, jenis, nominal, keterangan, tanggal, bukti, wallet:wallets!wallet_id(nama), tujuan:wallets!wallet_tujuan_id(nama), kategori:categories(nama)')
      .eq('user_id', uid)
      .gte('tanggal', awal)
      .lte('tanggal', akhir)
      .order('tanggal', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase.from('transactions').select('nominal').eq('user_id', uid).eq('jenis', 'pengeluaran').eq('tanggal', new Date().toISOString().slice(0, 10)),
  ])

  const wallets = walletsRes
  const kategori = kategoriRes.data ?? []
  
  // Menggunakan 'unknown' casting agar aman dari konflik tipe array/object Supabase
  const transaksi = (transaksiRes.data ?? []).map((t: any) => ({
    ...t,
    wallet: Array.isArray(t.wallet) ? t.wallet[0] : t.wallet,
    tujuan: Array.isArray(t.tujuan) ? t.tujuan[0] : t.tujuan,
    kategori: Array.isArray(t.kategori) ? t.kategori[0] : t.kategori,
  })) as Array<{
    id: number
    jenis: string
    nominal: number
    keterangan: string
    tanggal: string
    bukti: string | null
    wallet?: { nama: string } | null
    tujuan?: { nama: string } | null
    kategori?: { nama: string } | null
  }>

  const totalHariIni = (totalHariIniRes.data ?? []).reduce((acc, t) => acc + Number(t.nominal), 0)

  const jenisAwal = (sp.jenis === 'pemasukan' || sp.jenis === 'transfer' ? sp.jenis : 'pengeluaran') as Jenis

  return (
    <>
      <div><p className="text-xs text-slate-500">Catat pemasukan, pengeluaran, dan transfer antar wallet.</p></div>
      {sp.ok === 'ubah' && <Flash hasil={{ ok: 'Transaksi diperbarui.' }} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <ScanStruk wallets={wallets} kategori={kategori} />
          <TxForm aksi={tambahTransaksi} wallets={wallets} kategori={kategori} awal={{ jenis: jenisAwal, wallet_id: wallets[0]?.id }} mode="baru" />

          <div className="hs-card p-5 space-y-3">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <h4 className="text-sm font-black">Riwayat Transaksi</h4>
              <div className="flex items-center gap-2">
                <form method="get">
                  <input type="month" name="bulan" defaultValue={bulan} aria-label="Pilih bulan" className="px-3 py-1.5 text-xs border" />
                  <button className="hs-btn bg-hsYellow text-hsDark px-3 py-1.5 text-xs ml-1">Lihat</button>
                </form>
                <a href={`/transaksi/export?bulan=${bulan}`} className="hs-btn bg-slate-800 text-white px-3 py-1.5 text-xs" title="Unduh CSV">
                  <Download size={13} /> CSV
                </a>
              </div>
            </div>
            {transaksi.length === 0 && <p className="text-xs text-slate-500">Belum ada transaksi di bulan ini.</p>}
            {transaksi.map((t) => (
              <div key={t.id} className="fc-tx">
                <span className={`fc-tx-icon ${KELAS[t.jenis]}`}>{kategoriEmoji(t.kategori?.nama, t.jenis as Jenis)}</span>
                <div className="text-sm min-w-0 flex-1">
                  <p className="font-bold truncate">{t.keterangan}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    <span className="fc-chip">{t.jenis === 'transfer' ? `${t.wallet?.nama ?? ''} ke ${t.tujuan?.nama ?? ''}` : t.kategori?.nama ?? 'Lainnya'}</span>{' '}
                    {tgl(t.tanggal)}{t.jenis !== 'transfer' && ` · ${t.wallet?.nama ?? ''}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <p className={`font-display font-extrabold text-base ${WARNA[t.jenis]}`}>{TANDA[t.jenis]}{rupiah(t.nominal)}</p>
                  {t.bukti && (
                    <a href={`/transaksi/struk/${t.id}`} target="_blank" rel="noopener" className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 text-xs flex items-center justify-center" title="Lihat foto struk" aria-label="Lihat foto struk">
                      <ReceiptText size={14} />
                    </a>
                  )}
                  <Link href={`/transaksi/${t.id}/ubah`} className="w-8 h-8 rounded-full bg-slate-100 text-xs flex items-center justify-center" title="Ubah" aria-label="Ubah transaksi">
                    <Pencil size={13} />
                  </Link>
                  <TombolHapus aksi={hapusTransaksi} id={t.id} pesan="Hapus transaksi ini?" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <BatasHarianForm batas={profil.batas_harian} hariIni={totalHariIni} />
          <KategoriSaya kategori={kategori.filter((k) => k.user_id === uid)} />
        </div>
      </div>
    </>
  )
}