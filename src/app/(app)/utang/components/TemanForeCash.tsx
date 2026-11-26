'use client'

// Kode teman saya, tambah teman lewat kode, dan daftar teman ForeCash.
import { useState } from 'react'
import { Copy, Check, UserPlus, UserMinus } from 'lucide-react'
import Avatar from '@/components/Avatar'
import Flash from '@/components/Flash'
import { useAksi } from '@/lib/useAksi'
import { hapusTeman, tambahTeman } from '../actions'
import type { TemanFc } from './FormUtang'

function Putus({ t }: { t: TemanFc }) {
  const { pending, onSubmit } = useAksi(hapusTeman, { resetOk: false, sebelum: () => confirm(`Putus pertemanan dengan ${t.nama}?`) })
  return (
    <form onSubmit={onSubmit}>
      <input type="hidden" name="teman_id" value={t.id} />
      <button disabled={pending} className="w-8 h-8 rounded-full bg-red-50 text-hsRed inline-flex items-center justify-center disabled:opacity-50" aria-label={`Putus pertemanan dengan ${t.nama}`} title="Putus pertemanan">
        <UserMinus size={14} />
      </button>
    </form>
  )
}

export default function TemanForeCash({ kode, teman }: { kode: string | null; teman: TemanFc[] }) {
  const { hasil, pending, onSubmit, ref } = useAksi(tambahTeman)
  const [tersalin, setTersalin] = useState(false)

  async function salin() {
    if (!kode) return
    try {
      await navigator.clipboard.writeText(kode)
      setTersalin(true)
      setTimeout(() => setTersalin(false), 1500)
    } catch {
      /* clipboard tidak tersedia: kode tetap terlihat di layar */
    }
  }

  return (
    <section className="hs-card p-5 space-y-3" aria-label="Teman ForeCash">
      <h4 className="text-sm font-black"><UserPlus size={15} className="inline -mt-0.5 text-hsBlue" /> Teman ForeCash</h4>
      <p className="text-[11px] text-slate-500">Berteman di ForeCash supaya tagihan split bill langsung masuk ke akun temanmu, dan status lunasnya otomatis sama di kedua akun.</p>

      {kode ? (
        <div className="flex items-center gap-2 rounded-2xl bg-sky-50 px-3 py-2">
          <div className="flex-1">
            <p className="text-[10px] font-bold text-slate-500">Kode temanmu</p>
            <p className="font-black text-lg tracking-[.2em]">{kode}</p>
          </div>
          <button type="button" onClick={salin} className="hs-btn bg-white text-hsDark px-3 py-2 text-xs inline-flex items-center gap-1" style={{ border: '2px solid var(--line)' }}>
            {tersalin ? <Check size={14} /> : <Copy size={14} />} {tersalin ? 'Tersalin' : 'Salin'}
          </button>
        </div>
      ) : (
        <p className="text-[11px] font-bold text-hsRed">Kode teman belum tersedia. Jalankan migrasi database terbaru.</p>
      )}

      <form ref={ref} onSubmit={onSubmit} className="flex gap-2">
        <input name="kode" required maxLength={8} placeholder="Kode teman, mis. ANDI26" aria-label="Kode teman" className="flex-1 min-w-0 px-3 py-2 text-xs border uppercase" autoComplete="off" />
        <button disabled={pending} className="hs-btn bg-hsBlue text-white px-4 py-2 text-xs disabled:opacity-60">Tambah</button>
      </form>
      <Flash hasil={hasil} />

      {teman.length > 0 && (
        <ul className="space-y-1">
          {teman.map((t) => (
            <li key={t.id} className="flex items-center gap-2 py-1">
              <span className="fc-chip-av" style={{ width: 34, height: 34 }}><Avatar id={t.avatar} size={32} /></span>
              <span className="flex-1 text-sm font-bold truncate">{t.nama}</span>
              <Putus t={t} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
