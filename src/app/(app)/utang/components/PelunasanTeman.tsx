'use client'

// Temanmu menandai tagihan bersama sebagai lunas. Catat transaksinya ke wallet (atau abaikan).
import { BellRing } from 'lucide-react'
import Flash from '@/components/Flash'
import { useAksi } from '@/lib/useAksi'
import { rupiah } from '@/lib/format'
import { catatPelunasanTeman } from '../actions'

export type Pelunasan = { id: number; nama_teman: string; keterangan: string; nominal: number; arah: 'piutang' | 'utang' }

function Baris({ d, wallets }: { d: Pelunasan; wallets: { id: number; nama: string }[] }) {
  const { hasil, pending, onSubmit } = useAksi(catatPelunasanTeman, { resetOk: false })
  const masuk = d.arah === 'piutang'
  return (
    <div className="py-2 border-b last:border-0 space-y-2">
      <p className="text-xs">
        <b>{d.nama_teman}</b> menandai <b>{d.keterangan}</b> ({rupiah(d.nominal)}) sudah lunas.
        {masuk ? ' Uangnya sudah kamu terima?' : ' Sudah kamu bayar?'}
      </p>
      <form onSubmit={onSubmit} className="flex gap-2 flex-wrap">
        <input type="hidden" name="id" value={d.id} />
        <select name="wallet_id" aria-label={masuk ? 'Masuk ke wallet' : 'Dibayar dari wallet'} className="flex-1 min-w-[120px] px-2 py-1.5 text-[11px] border">
          {wallets.map((w) => <option key={w.id} value={w.id}>{w.nama}</option>)}
        </select>
        <button disabled={pending} className="hs-btn bg-hsGreen text-white px-3 py-1.5 text-[11px] disabled:opacity-60">Catat {masuk ? 'pemasukan' : 'pengeluaran'}</button>
        <button disabled={pending} name="abaikan" value="1" className="hs-btn bg-white text-hsDark px-3 py-1.5 text-[11px]" style={{ border: '2px solid var(--line)' }}>Abaikan</button>
      </form>
      <Flash hasil={hasil} />
    </div>
  )
}

export default function PelunasanTeman({ daftar, wallets }: { daftar: Pelunasan[]; wallets: { id: number; nama: string }[] }) {
  if (daftar.length === 0) return null
  return (
    <section className="hs-card p-5 space-y-1" style={{ borderColor: 'var(--sun)' }} aria-label="Pelunasan dari teman">
      <h4 className="text-sm font-black"><BellRing size={15} className="inline -mt-0.5 text-hsOrange" /> Ditandai lunas oleh teman</h4>
      {daftar.map((d) => <Baris key={d.id} d={d} wallets={wallets} />)}
    </section>
  )
}
