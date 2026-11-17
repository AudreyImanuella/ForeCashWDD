'use client'

// Target tabungan: kemajuan, saran setoran per minggu, tombol setor, dan form target baru.
import { PartyPopper } from 'lucide-react'
import Flash from '@/components/Flash'
import InputRupiah from '@/components/form/InputRupiah'
import TombolHapus from '@/components/TombolHapus'
import { useAksi } from '@/lib/useAksi'
import { rupiah } from '@/lib/format'
import type { InfoTarget } from '@/lib/rencana'
import { tgl } from '@/lib/tanggal'
import { hapusTarget, setorTarget, tambahTarget } from '../actions'

export type TargetTabungan = { id: number; nama: string; target: number; terkumpul: number; tenggat: string | null; info: InfoTarget }

function KartuTarget({ t }: { t: TargetTabungan }) {
  const { hasil, pending, onSubmit, ref } = useAksi(setorTarget)
  const i = t.info
  return (
    <div className="rounded-3xl bg-amber-50 p-4 space-y-2">
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0">
          <p className="font-black truncate">{t.nama}</p>
          <p className="text-xs text-slate-500">{rupiah(t.terkumpul)} dari {rupiah(t.target)}{t.tenggat && ` · tenggat ${tgl(t.tenggat)}`}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <b className="text-sm">{i.persen}%</b>
          <TombolHapus aksi={hapusTarget} id={t.id} pesan={`Hapus target "${t.nama}"?`} tampilError={false} />
        </div>
      </div>
      <div className="w-full bg-white rounded-full h-3" role="progressbar" aria-valuenow={i.persen} aria-valuemin={0} aria-valuemax={100} aria-label={`Kemajuan ${t.nama}`}>
        <div className={`${i.tercapai ? 'bg-hsGreen' : 'bg-hsOrange'} h-3 rounded-full`} style={{ width: `${i.persen}%` }} />
      </div>
      {i.tercapai ? (
        <p className="text-xs font-bold text-hsGreen inline-flex items-center gap-1"><PartyPopper size={14} /> Tercapai!</p>
      ) : (
        <>
          <p className="text-[11px] font-bold">
            {i.perMinggu ? `Sisihkan ${rupiah(i.perMinggu)}/minggu supaya tercapai tepat waktu.` : i.telat ? `Tenggat lewat, kurang ${rupiah(i.kurang)}.` : `Kurang ${rupiah(i.kurang)} lagi.`}
          </p>
          <form ref={ref} onSubmit={onSubmit} className="flex gap-2">
            <input type="hidden" name="id" value={t.id} />
            <InputRupiah name="nominal" required placeholder="50.000" aria-label={`Setoran untuk ${t.nama}`} className="flex-1" />
            <button disabled={pending} className="hs-btn bg-hsOrange text-white px-3 py-2 text-xs disabled:opacity-60">Setor</button>
          </form>
        </>
      )}
      <Flash hasil={hasil} />
    </div>
  )
}

export default function Target({ targets }: { targets: TargetTabungan[] }) {
  const { hasil, pending, onSubmit, ref } = useAksi(tambahTarget)
  return (
    <section className="hs-card p-6 space-y-3" aria-label="Target tabungan">
      <h4 className="text-sm font-black">Target Tabungan</h4>
      {targets.length === 0 && <p className="text-xs text-slate-500">Mau beli apa? Laptop, tiket konser, dana darurat... buat targetnya di bawah.</p>}
      {targets.map((t) => <KartuTarget key={t.id} t={t} />)}
      <p className="text-[10px] text-slate-500">Uang tabungan tetap tersimpan di wallet-mu. Kalau mau dipisah, buat wallet &quot;Tabungan&quot;.</p>

      <form ref={ref} onSubmit={onSubmit} className="pt-3 border-t space-y-2">
        <p className="text-xs font-bold">Target baru</p>
        <Flash hasil={hasil} />
        <div><label htmlFor="tn" className="text-xs font-bold">Nama</label><input id="tn" name="nama" required maxLength={80} placeholder="Laptop baru" className="w-full px-3 py-2 text-xs border" /></div>
        <div><label htmlFor="tt" className="text-xs font-bold">Jumlah target</label><InputRupiah id="tt" name="target" required placeholder="8.000.000" /></div>
        <div><label htmlFor="tg" className="text-xs font-bold">Tenggat (opsional)</label><input id="tg" type="date" name="tenggat" className="w-full px-3 py-2 text-xs border" /></div>
        <button disabled={pending} className="hs-btn bg-hsOrange text-white w-full py-2.5 text-xs disabled:opacity-60">Buat Target</button>
      </form>
    </section>
  )
}
