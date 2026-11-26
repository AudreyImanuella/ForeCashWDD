'use client'

// Form Split Bill (dengan pratinjau per orang) dan form Catat Utang/Piutang.
import { useState } from 'react'
import { Calculator, Plus, Check } from 'lucide-react'
import clsx from 'clsx'
import Avatar from '@/components/Avatar'
import Flash from '@/components/Flash'
import { useAksi } from '@/lib/useAksi'
import { rupiah } from '@/lib/format'
import { bagianSplit, daftarTeman } from '@/lib/utang'
import { konfirmasiNominal } from '@/app/(app)/transaksi/components/TxForm'
import { catatUtang, splitBill } from '../actions'
import InputRupiah from '@/components/form/InputRupiah'

export type TemanFc = { id: string; nama: string; avatar: string }

export function SplitBillForm({ temanFc = [] }: { temanFc?: TemanFc[] }) {
  const { hasil, pending, onSubmit, ref } = useAksi(splitBill, { sebelum: (f) => konfirmasiNominal(f, 'total') })
  const [total, setTotal] = useState('')
  const [teman, setTeman] = useState('')
  const [pilih, setPilih] = useState<string[]>([])
  const [ikut, setIkut] = useState(true)
  const nama = daftarTeman(teman)
  const jumlah = nama.length + pilih.length
  const per = Number(total) > 0 && jumlah ? bagianSplit(Number(total), jumlah, ikut) : null

  function reset() {
    setTotal('')
    setTeman('')
    setPilih([])
    setIkut(true)
  }
  const toggle = (id: string) => setPilih((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  return (
    <form id="split" ref={ref} onSubmit={onSubmit} onReset={reset} className="hs-card p-5 space-y-3">
      <h4 className="text-sm font-black"><Calculator size={15} className="inline -mt-0.5 text-hsPurple" /> Split Bill</h4>
      <Flash hasil={hasil} />
      <div><label htmlFor="sj" className="text-xs font-bold">Judul</label><input id="sj" name="judul" maxLength={150} placeholder="Makan malam angkatan" className="w-full px-3 py-2 text-xs border" /></div>
      <div><label htmlFor="st" className="text-xs font-bold">Total tagihan (Rp)</label><InputRupiah id="st" name="total" required value={total} onValueChange={setTotal} placeholder="150.000" /></div>
      {temanFc.length > 0 && (
        <fieldset className="space-y-1.5">
          <legend className="text-xs font-bold">Teman ForeCash (tagihan langsung masuk ke akunnya)</legend>
          <div className="flex flex-wrap gap-2">
            {temanFc.map((t) => {
              const on = pilih.includes(t.id)
              return (
                <label key={t.id} className={clsx('fc-chip-teman', on && 'is-on')}>
                  <input type="checkbox" name="teman_fc" value={t.id} checked={on} onChange={() => toggle(t.id)} className="sr-only" />
                  <span className="fc-chip-av"><Avatar id={t.avatar} size={26} /></span>
                  {t.nama.split(' ')[0]}
                  {on && <Check size={13} strokeWidth={3} />}
                </label>
              )
            })}
          </div>
        </fieldset>
      )}
      <div><label htmlFor="sn" className="text-xs font-bold">{temanFc.length ? 'Teman lain (pisahkan dengan koma)' : 'Nama teman (pisahkan dengan koma)'}</label><input id="sn" name="teman" required={pilih.length === 0} value={teman} onChange={(e) => setTeman(e.target.value)} placeholder="Budi, Siti, Bima" className="w-full px-3 py-2 text-xs border" /></div>
      <label className="flex items-center gap-2 text-xs font-bold">
        <input type="checkbox" name="termasuk_saya" value="1" checked={ikut} onChange={(e) => setIkut(e.target.checked)} /> Saya ikut menanggung bagian
      </label>
      {per !== null && <p className="text-xs font-bold text-hsPurple">{rupiah(per)} per orang · {jumlah} piutang akan dicatat{pilih.length > 0 && `, ${pilih.length} tagihan dikirim`}</p>}
      <div><label htmlFor="sd" className="text-xs font-bold">Jatuh tempo (opsional)</label><input id="sd" type="date" name="jatuh_tempo" className="w-full px-3 py-2 text-xs border" /></div>
      <button disabled={pending} className="hs-btn bg-hsPurple text-white w-full py-2.5 text-xs disabled:opacity-60">Bagi & Catat Piutang</button>
    </form>
  )
}

export function CatatUtangForm({ temanFc = [] }: { temanFc?: TemanFc[] }) {
  const { hasil, pending, onSubmit, ref } = useAksi(catatUtang, { sebelum: (f) => konfirmasiNominal(f) })
  const [fc, setFc] = useState('')
  return (
    <form ref={ref} onSubmit={onSubmit} onReset={() => setFc('')} className="hs-card p-5 space-y-3">
      <h4 className="text-sm font-black"><Plus size={15} className="inline -mt-0.5 text-hsGreen" /> Catat Utang / Piutang</h4>
      <Flash hasil={hasil} />
      {temanFc.length > 0 && (
        <div><label htmlFor="dfc" className="text-xs font-bold">Teman ForeCash (opsional)</label>
          <select id="dfc" name="teman_fc" value={fc} onChange={(e) => setFc(e.target.value)} className="w-full px-3 py-2 text-xs border">
            <option value="">Bukan pengguna ForeCash</option>
            {temanFc.map((t) => <option key={t.id} value={t.id}>{t.nama}</option>)}
          </select>
        </div>
      )}
      {!fc && <div><label htmlFor="dn" className="text-xs font-bold">Nama teman</label><input id="dn" name="nama_teman" required maxLength={100} className="w-full px-3 py-2 text-xs border" /></div>}
      <div><label htmlFor="dk" className="text-xs font-bold">Keterangan</label><input id="dk" name="keterangan" required maxLength={150} placeholder="Pinjam untuk ongkos" className="w-full px-3 py-2 text-xs border" /></div>
      <div><label htmlFor="dnom" className="text-xs font-bold">Nominal (Rp)</label><InputRupiah id="dnom" name="nominal" required placeholder="20.000" /></div>
      <div><label htmlFor="da" className="text-xs font-bold">Posisi</label>
        <select id="da" name="arah" className="w-full px-3 py-2 text-xs border">
          <option value="piutang">Dia utang ke saya (piutang)</option>
          {!fc && <option value="utang">Saya utang ke dia (utang)</option>}
        </select>
        {fc && <p className="text-[10px] text-slate-500 mt-1">Tagihan akan muncul di akun temanmu.</p>}
      </div>
      <div><label htmlFor="dt" className="text-xs font-bold">Jatuh tempo (opsional)</label><input id="dt" type="date" name="jatuh_tempo" className="w-full px-3 py-2 text-xs border" /></div>
      <button disabled={pending} className="hs-btn bg-hsGreen text-white w-full py-2.5 text-xs disabled:opacity-60">Simpan</button>
    </form>
  )
}
