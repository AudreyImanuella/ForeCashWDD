'use client'

// Anggaran bulanan per kategori: bilah terpakai/sisa + ubah batas di tempat.
import { useState } from 'react'
import { Pencil } from 'lucide-react'
import clsx from 'clsx'
import Flash from '@/components/Flash'
import InputRupiah from '@/components/form/InputRupiah'
import { useAksi } from '@/lib/useAksi'
import { rupiah } from '@/lib/format'
import type { BarisAnggaran } from '@/lib/rencana'
import { simpanAnggaran } from '../actions'

const WARNA = { aman: 'bg-hsGreen', hampir: 'bg-hsYellow', lewat: 'bg-hsRed' }
const KET = { aman: 'text-slate-500', hampir: 'text-amber-700', lewat: 'text-hsRed' }

function Baris({ a }: { a: BarisAnggaran }) {
  const [ubah, setUbah] = useState(false)
  const { hasil, pending, onSubmit } = useAksi(simpanAnggaran, { resetOk: false })
  const ket = a.status === 'lewat' ? `Lewat ${rupiah(-a.sisa)}` : a.status === 'hampir' ? `Hampir habis · sisa ${rupiah(a.sisa)}` : `Sisa ${rupiah(a.sisa)}`
  return (
    <div className="py-3 border-b last:border-0 space-y-1.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm font-bold">{a.nama}</p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">{rupiah(a.terpakai)} / {rupiah(a.batas)}</span>
          <button type="button" onClick={() => setUbah((v) => !v)} className="w-8 h-8 rounded-full bg-amber-50 text-hsOrange inline-flex items-center justify-center" aria-label={`Ubah anggaran ${a.nama}`} title="Ubah">
            <Pencil size={14} />
          </button>
        </div>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2.5" role="progressbar" aria-valuenow={a.persen} aria-valuemin={0} aria-valuemax={100} aria-label={`Anggaran ${a.nama} terpakai`}>
        <div className={clsx(WARNA[a.status], 'h-2.5 rounded-full')} style={{ width: `${a.persen}%` }} />
      </div>
      <p className={clsx('text-[11px] font-bold', KET[a.status])}>{ket}</p>
      {ubah && (
        <form onSubmit={onSubmit} className="flex gap-2 items-center pt-1">
          <input type="hidden" name="category_id" value={a.category_id} />
          <InputRupiah name="batas" defaultValue={a.batas} aria-label={`Batas baru ${a.nama}`} className="flex-1" />
          <button disabled={pending} className="hs-btn bg-slate-800 text-white px-3 py-2 text-xs disabled:opacity-60">Simpan</button>
        </form>
      )}
      {ubah && <p className="text-[10px] text-slate-500">Isi 0 untuk menghapus anggaran kategori ini.</p>}
      <Flash hasil={hasil} />
    </div>
  )
}

type Props = {
  baris: BarisAnggaran[]
  kategoriKosong: { id: number; nama: string }[]
  bulan: string
  total: { batas: number; terpakai: number }
}

export default function Anggaran({ baris, kategoriKosong, bulan, total }: Props) {
  const { hasil, pending, onSubmit, ref } = useAksi(simpanAnggaran)
  return (
    <section className="hs-card p-6 space-y-2" aria-label="Anggaran per kategori">
      <div className="flex justify-between items-baseline gap-2 flex-wrap">
        <h4 className="text-sm font-black">Anggaran {bulan}</h4>
        {baris.length > 0 && <span className="text-xs text-slate-500">{rupiah(total.terpakai)} dari {rupiah(total.batas)}</span>}
      </div>
      {baris.length === 0 && <p className="text-xs text-slate-500">Belum ada anggaran. Tentukan batas belanja per kategori supaya tahu kapan harus mengerem.</p>}
      {baris.map((a) => <Baris key={a.category_id} a={a} />)}

      {kategoriKosong.length > 0 && (
        <form ref={ref} onSubmit={onSubmit} className="pt-3 space-y-2">
          <p className="text-xs font-bold">Tambah anggaran</p>
          <div className="flex gap-2 flex-wrap">
            <select name="category_id" aria-label="Kategori" className="flex-1 min-w-[140px] px-3 py-2 text-xs border">
              {kategoriKosong.map((k) => <option key={k.id} value={k.id}>{k.nama}</option>)}
            </select>
            <InputRupiah name="batas" required placeholder="500.000" aria-label="Batas per bulan" className="flex-1 min-w-[140px]" />
            <button disabled={pending} className="hs-btn bg-hsOrange text-white px-4 py-2 text-xs disabled:opacity-60">Tambah</button>
          </div>
          <Flash hasil={hasil} />
        </form>
      )}
    </section>
  )
}
