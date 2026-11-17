'use client'

// Notifikasi "Badge baru!" saat ada badge yang naik tingkat sejak kunjungan terakhir.
// Disimpan di browser (localStorage) per akun; kunjungan pertama hanya mencatat, tidak memunculkan notifikasi.
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import Link from 'next/link'
import BadgeIkon from '@/components/BadgeIkon'
import { TINGKAT, type IkonBadge } from '@/lib/gamify'

type Item = { key: IkonBadge; nama: string; tingkat: number }

export default function BadgeBaru({ uid, badges }: { uid: string; badges: Item[] }) {
  const [baru, setBaru] = useState<Item[]>([])

  useEffect(() => {
    const kunci = `fc_badge_${uid}`
    const sekarang = Object.fromEntries(badges.map((b) => [b.key, b.tingkat]))
    let lama: Record<string, number> | null = null
    try {
      const s = localStorage.getItem(kunci)
      lama = s ? JSON.parse(s) : null
      localStorage.setItem(kunci, JSON.stringify(sekarang))
    } catch {
      return
    }
    if (!lama) return
    const naik = badges.filter((b) => b.tingkat > (lama![b.key] ?? 0))
    if (naik.length) {
      const t = setTimeout(() => setBaru(naik), 400)
      return () => clearTimeout(t)
    }
  }, [uid, badges])

  if (!baru.length) return null
  const b = baru[0]
  return (
    <div className="fc-badge-toast" role="status" aria-live="polite">
      <BadgeIkon ikon={b.key} tingkat={b.tingkat} size={56} />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-black text-hsOrange tracking-wide">BADGE BARU!</p>
        <p className="font-black text-sm">{b.nama} · {TINGKAT[b.tingkat]}</p>
        <p className="text-[11px] text-slate-500">
          {baru.length > 1 ? `+${baru.length - 1} badge lain. ` : ''}<Link href="/pencapaian" className="font-bold text-hsOrange">Lihat koleksi</Link>
        </p>
      </div>
      <button type="button" onClick={() => setBaru([])} className="w-8 h-8 rounded-full inline-flex items-center justify-center text-slate-500" aria-label="Tutup">
        <X size={16} />
      </button>
    </div>
  )
}
