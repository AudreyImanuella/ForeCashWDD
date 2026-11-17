'use client'

import Flash from '@/components/Flash'
import { useAksi } from '@/lib/useAksi'
import { rupiah } from '@/lib/format'
import { simpanBatasHarian } from '../actions'
import InputRupiah from '@/components/form/InputRupiah'

export default function BatasHarianForm({ batas, hariIni }: { batas: number; hariIni: number }) {
  const { hasil, pending, onSubmit } = useAksi(simpanBatasHarian, { resetOk: false })
  const lewat = hariIni > batas
  return (
    <form onSubmit={onSubmit} className="hs-card p-5 space-y-2">
      <h4 className="text-sm font-black">Batas Pengeluaran Harian</h4>
      <Flash hasil={hasil} />
      <InputRupiah name="batas_harian" defaultValue={batas} aria-label="Batas pengeluaran harian (Rp)" />
      <button disabled={pending} className="hs-btn bg-slate-800 text-white w-full py-2 text-xs disabled:opacity-60">Simpan</button>
      {batas > 0 && (
        <p className={`text-[11px] font-bold ${lewat ? 'text-hsRed' : 'text-hsGreen'}`}>
          Hari ini: {rupiah(hariIni)} dari {rupiah(batas)} {lewat ? '— melebihi batas!' : '— masih aman.'}
        </p>
      )}
    </form>
  )
}
