'use client'

// Pengeluaran yang sudah direncanakan: tombol "Sudah dibayar" (+ pilih wallet), hapus, dan form tambah.
import { Repeat } from 'lucide-react'
import clsx from 'clsx'
import Flash from '@/components/Flash'
import InputRupiah from '@/components/form/InputRupiah'
import TombolHapus from '@/components/TombolHapus'
import { useAksi } from '@/lib/useAksi'
import { rupiah } from '@/lib/format'
import { tgl } from '@/lib/tanggal'
import { konfirmasiNominal } from '@/app/(app)/transaksi/components/TxForm'
import { bayarRencana, hapusRencana, tambahRencana } from '../actions'

export type Rencana = { id: number; nama: string; nominal: number; tanggal: string; berulang: boolean; kategori: string | null }
type Opsi = { id: number; nama: string }

function Baris({ r, wallets, hariIni }: { r: Rencana; wallets: Opsi[]; hariIni: string }) {
  const bayar = useAksi(bayarRencana, { resetOk: false })
  const telat = r.tanggal < hariIni
  const [, bln, hr] = r.tanggal.split('-')
  const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  return (
    <div className="py-3 border-b last:border-0 space-y-2">
      <div className="flex items-center gap-3">
        <div className={clsx('w-14 h-14 rounded-2xl flex flex-col items-center justify-center shrink-0', telat ? 'bg-red-100 text-hsRed' : 'bg-amber-100')}>
          <b className="text-lg leading-none">{Number(hr)}</b><span className="text-[10px] font-bold">{BULAN[Number(bln) - 1]}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate">{r.nama}</p>
          <p className={clsx('text-[11px]', telat ? 'text-hsRed font-bold' : 'text-slate-500')}>
            {telat ? `Lewat sejak ${tgl(r.tanggal)}` : r.kategori ?? 'Tanpa kategori'}
            {r.berulang && <span className="inline-flex items-center gap-0.5 ml-1"><Repeat size={11} /> tiap bulan</span>}
          </p>
        </div>
        <p className="font-black text-sm shrink-0">{rupiah(r.nominal)}</p>
      </div>
      <Flash hasil={bayar.hasil} />
      <div className="flex items-center gap-2">
        <form onSubmit={bayar.onSubmit} className="flex gap-2 flex-1">
          <input type="hidden" name="id" value={r.id} />
          <select name="wallet_id" aria-label="Bayar dari wallet" title="Bayar dari wallet" className="flex-1 min-w-0 px-2 py-1.5 text-[11px] border">
            {wallets.map((w) => <option key={w.id} value={w.id}>{w.nama}</option>)}
          </select>
          <button disabled={bayar.pending} className="hs-btn bg-hsGreen text-white px-3 py-1.5 text-[11px] disabled:opacity-60">Sudah dibayar</button>
        </form>
        <TombolHapus aksi={hapusRencana} id={r.id} pesan="Hapus rencana ini?" tampilError={false} />
      </div>
    </div>
  )
}

type Props = { rencana: Rencana[]; wallets: Opsi[]; kategori: Opsi[]; hariIni: string; rencanaDulu: number; sebelum: string | null }

export default function RencanaBayar({ rencana, wallets, kategori, hariIni, rencanaDulu, sebelum }: Props) {
  const { hasil, pending, onSubmit, ref } = useAksi(tambahRencana, { sebelum: (f) => konfirmasiNominal(f) })
  return (
    <section className="hs-card p-6 space-y-2" aria-label="Pengeluaran yang direncanakan">
      <h4 className="text-sm font-black">Pengeluaran yang Direncanakan</h4>
      {rencana.length === 0 && <p className="text-xs text-slate-500">Bayar kos, UKT, kado teman... catat di sini supaya Prediksi tidak kaget.</p>}
      {rencana.map((r) => <Baris key={r.id} r={r} wallets={wallets} hariIni={hariIni} />)}
      {rencanaDulu > 0 && (
        <p className="text-[11px] font-bold rounded-2xl bg-emerald-50 text-emerald-800 px-3 py-2">
          {rupiah(rencanaDulu)} jatuh sebelum {sebelum ? `pemasukan berikutnya (${tgl(sebelum)})` : '30 hari ke depan'} dan sudah dihitung di Prediksi.
        </p>
      )}

      <form ref={ref} onSubmit={onSubmit} className="pt-3 border-t space-y-2">
        <p className="text-xs font-bold">Tambah rencana</p>
        <Flash hasil={hasil} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div><label htmlFor="rn" className="text-xs font-bold">Nama</label><input id="rn" name="nama" required maxLength={100} placeholder="Bayar kos Desember" className="w-full px-3 py-2 text-xs border" /></div>
          <div><label htmlFor="rnom" className="text-xs font-bold">Nominal</label><InputRupiah id="rnom" name="nominal" required placeholder="1.200.000" /></div>
          <div><label htmlFor="rt" className="text-xs font-bold">Tanggal</label><input id="rt" type="date" name="tanggal" required className="w-full px-3 py-2 text-xs border" /></div>
          <div><label htmlFor="rk" className="text-xs font-bold">Kategori</label>
            <select id="rk" name="category_id" className="w-full px-3 py-2 text-xs border">
              <option value="">Tanpa kategori</option>
              {kategori.map((k) => <option key={k.id} value={k.id}>{k.nama}</option>)}
            </select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" name="berulang" value="1" /> Berulang tiap bulan</label>
        <button disabled={pending} className="hs-btn bg-hsOrange text-white w-full py-2.5 text-xs disabled:opacity-60">Simpan Rencana</button>
      </form>
    </section>
  )
}
