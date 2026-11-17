// Pencapaian: level, streak, tantangan mingguan, dan koleksi badge bertingkat.
import { Flag, Flame, Sparkles } from 'lucide-react'
import Avatar from '@/components/Avatar'
import BadgeIkon from '@/components/BadgeIkon'
import BadgeBaru from '@/components/BadgeBaru'
import { KartuBadge, LevelBar, Tantangan, sisaBadge } from '@/components/Gamifikasi'
import { wajibLogin } from '@/lib/auth'
import { ambilForecast } from '@/lib/data'
import { ambilGamify, POIN_TINGKAT, TINGKAT } from '@/lib/gamify'

export const metadata = { title: 'Pencapaian' }

export default async function PencapaianPage() {
  const { supabase, profil } = await wajibLogin('mahasiswa')
  const f = await ambilForecast(supabase, profil.id)
  const g = await ambilGamify(supabase, profil.id, profil.batas_harian, f.status)
  const koleksi = g.badges.reduce((s, b) => s + b.tingkat, 0)
  const urut = [...g.badges].sort((a, b) => b.tingkat - a.tingkat || b.persen - a.persen)

  return (
    <>
      <BadgeBaru uid={profil.id} badges={g.badges.map((b) => ({ key: b.key, nama: b.nama, tingkat: b.tingkat }))} />
      <div><p className="text-xs text-slate-500">Badge didapat dari kebiasaan baik: hemat, patuh anggaran, menabung, patungan, dan melunasi utang. Setiap badge punya 3 tingkat.</p></div>

      <section className="hs-card p-6 flex flex-wrap items-center gap-6">
        <div className="w-24 h-24 bg-hsYellow/40 rounded-full flex items-end justify-center overflow-hidden shrink-0"><Avatar id={profil.avatar} size={88} /></div>
        <div className="flex-1 min-w-[200px]">
          <p className="text-xl font-black">{profil.nama}</p>
          <div className="mt-2"><LevelBar g={g} /></div>
        </div>
        <div className="flex gap-6">
          <div className="text-center">
            <Flame size={30} className="mx-auto text-hsOrange" />
            <p className="text-xl font-black">{g.streak} hari</p>
            <p className="text-[11px] text-slate-500">streak · rekor {g.streakTerpanjang}</p>
          </div>
          <div className="text-center">
            <Sparkles size={30} className="mx-auto text-hsPurple" />
            <p className="text-xl font-black">{koleksi}/{g.badges.length * 3}</p>
            <p className="text-[11px] text-slate-500">tingkat terkumpul</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="hs-card p-6 space-y-2">
          <h4 className="text-sm font-black"><Flag size={15} className="inline -mt-0.5 text-hsOrange" /> Tantangan Minggu Ini</h4>
          <Tantangan t={g.tantangan} />
          <p className="text-[10px] text-slate-500">Tantangan berganti setiap Senin.</p>
        </section>
        {g.hampir && (
          <section className="hs-card p-6 flex items-center gap-4">
            <BadgeIkon ikon={g.hampir.icon} tingkat={g.hampir.tingkat + 1} size={64} />
            <div>
              <p className="text-[11px] font-black text-hsOrange tracking-wide">SEDIKIT LAGI!</p>
              <p className="font-black">{g.hampir.nama} · {TINGKAT[g.hampir.tingkat + 1]}</p>
              <p className="text-xs text-slate-500">{sisaBadge(g.hampir)} · {g.hampir.ket.toLowerCase()}</p>
            </div>
          </section>
        )}
      </div>

      <section className="space-y-3">
        <h4 className="text-sm font-black">Koleksi Badge</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {urut.map((b) => <KartuBadge key={b.key} b={b} />)}
        </div>
      </section>

      <section className="hs-card p-5 text-xs text-slate-600 space-y-1">
        <p className="font-bold text-hsDark">Cara mendapat poin</p>
        <p>Perunggu {POIN_TINGKAT[1]} poin, Perak {POIN_TINGKAT[2]} poin, Emas {POIN_TINGKAT[3]} poin per badge. Setiap hari streak bernilai 10 poin (maks. 30 hari).</p>
      </section>
    </>
  )
}
