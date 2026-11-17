// Potongan tampilan gamifikasi: bilah level, tantangan mingguan, dan kartu badge.
// Dipakai di Beranda dan Pencapaian.
import clsx from 'clsx'
import BadgeIkon from '@/components/BadgeIkon'
import { TINGKAT, type Badge, type Gamify } from '@/lib/gamify'
import { rupiah } from '@/lib/format'

export function LevelBar({ g }: { g: Gamify }) {
  const pct = g.nextPoin ? Math.round(((g.poin - g.prevPoin) / (g.nextPoin - g.prevPoin)) * 100) : 100
  const ket = g.nextPoin ? `${g.nextPoin - g.poin} poin lagi menuju ${g.nextNama}` : 'Level tertinggi tercapai!'
  return (
    <>
      <div className="flex justify-between text-xs font-bold">
        <span>Level {g.level} · {g.levelNama}</span>
        <span>{g.poin} poin</span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-3 mt-1" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Kemajuan level">
        <div className="bg-hsPurple h-3 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[10px] text-slate-500 mt-1">{ket}</p>
    </>
  )
}

export function Tantangan({ t }: { t: Gamify['tantangan'] }) {
  const pct = Math.min(100, Math.round((t.now / t.max) * 100))
  const angka = (n: number) => (t.satuan === 'rp' ? rupiah(n) : `${n} hari`)
  let ket: string
  if (t.jenis === 'maks') {
    ket = t.gagal ? 'Lewat batas, coba lagi minggu depan' : `sisa ${rupiah(t.max - t.now)}, ${t.sisaHari} hari lagi`
  } else {
    ket = t.selesai ? 'Selesai! Mantap.' : t.gagal ? 'Tidak terkejar minggu ini, coba lagi minggu depan' : `${t.max - t.now} hari lagi, sisa ${t.sisaHari} hari`
  }
  const warna = t.gagal ? 'bg-hsRed' : t.jenis === 'maks' ? 'bg-hsGreen' : 'bg-hsOrange'
  return (
    <>
      <p className="text-sm font-bold">{t.judul}</p>
      <div className="w-full bg-slate-100 rounded-full h-3 mt-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Kemajuan tantangan">
        <div className={`${t.selesai ? 'bg-hsGreen' : warna} h-3 rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <p className={clsx('text-[11px] mt-1', t.gagal ? 'text-hsRed font-bold' : t.selesai ? 'text-hsGreen font-bold' : 'text-slate-500')}>
        {angka(t.now)}{t.jenis === 'maks' ? ' terpakai' : ` dari ${angka(t.max)}`} · {ket}
      </p>
    </>
  )
}

/** "1/3 lagi", "Rp 120.000 lagi" menuju tingkat berikutnya */
export function sisaBadge(b: Badge): string {
  if (b.berikut === null) return 'Emas'
  const kurang = b.berikut - b.nilai
  return b.satuan === 'rp' ? `${rupiah(kurang)} lagi` : `${kurang} lagi`
}

export function KartuBadge({ b }: { b: Badge }) {
  return (
    <div className={clsx('hs-card p-4 text-center space-y-2', b.tingkat === 0 && 'opacity-75')}>
      <div className="flex justify-center"><BadgeIkon ikon={b.icon} tingkat={b.tingkat} size={60} /></div>
      <p className="text-sm font-black">{b.nama}</p>
      <span className={`fc-tier fc-tier-${b.tingkat}`}>{TINGKAT[b.tingkat]}</span>
      <p className="text-[11px] text-slate-500 min-h-[30px]">{b.ket}</p>
      {b.berikut !== null ? (
        <>
          <div className="w-full bg-slate-100 rounded-full h-2" role="progressbar" aria-valuenow={b.persen} aria-valuemin={0} aria-valuemax={100} aria-label={`Kemajuan ${b.nama}`}>
            <div className="bg-hsOrange h-2 rounded-full" style={{ width: `${b.persen}%` }} />
          </div>
          <p className="text-[10px] font-bold">{sisaBadge(b)} menuju {TINGKAT[b.tingkat + 1]}</p>
        </>
      ) : (
        <p className="text-[10px] font-bold text-amber-700">Tingkat tertinggi!</p>
      )}
    </div>
  )
}
