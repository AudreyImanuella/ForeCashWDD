// Rencana: anggaran per kategori, target tabungan, dan pengeluaran yang direncanakan.
import { wajibLogin } from '@/lib/auth'
import { ambilForecast, ambilWallet } from '@/lib/data'
import { infoTarget, ringkasAnggaran } from '@/lib/rencana'
import { hariIni, namaBulan, rentangBulan } from '@/lib/tanggal'
import Anggaran from './components/Anggaran'
import Target, { type TargetTabungan } from './components/Target'
import RencanaBayar, { type Rencana } from './components/RencanaBayar'

export const metadata = { title: 'Rencana' }

export default async function RencanaPage() {
  const { supabase, profil } = await wajibLogin('mahasiswa')
  const uid = profil.id
  const hari = hariIni()
  const bulan = hari.slice(0, 7)
  const [dari, sampai] = rentangBulan(bulan)

  const wallets = await ambilWallet(supabase, uid)
  const [f, kat, ang, keluar, tgt, ren] = await Promise.all([
    ambilForecast(supabase, uid, wallets),
    supabase.from('categories').select('id, nama').eq('jenis', 'pengeluaran').or(`user_id.is.null,user_id.eq.${uid}`).order('id'),
    supabase.from('anggaran').select('category_id, batas').eq('user_id', uid),
    supabase.from('transactions').select('category_id, nominal').eq('user_id', uid).eq('jenis', 'pengeluaran').gte('tanggal', dari).lt('tanggal', sampai),
    supabase.from('target_tabungan').select('id, nama, target, terkumpul, tenggat').eq('user_id', uid).order('tercapai_pada', { ascending: false, nullsFirst: true }).order('created_at'),
    supabase.from('rencana_pengeluaran').select('id, nama, nominal, tanggal, berulang, kategori:categories(nama)').eq('user_id', uid).eq('status', 'rencana').order('tanggal'),
  ])

  const kategori = kat.data ?? []
  const namaKat = new Map(kategori.map((k) => [k.id, k.nama]))
  const terpakai: Record<number, number> = {}
  for (const t of keluar.data ?? []) if (t.category_id) terpakai[t.category_id] = (terpakai[t.category_id] ?? 0) + Number(t.nominal)
  const baris = ringkasAnggaran(
    (ang.data ?? []).filter((a) => namaKat.has(a.category_id)).map((a) => ({ category_id: a.category_id, nama: namaKat.get(a.category_id)!, batas: Number(a.batas) })),
    terpakai,
  )
  const punya = new Set(baris.map((b) => b.category_id))
  const total = baris.reduce((s, b) => ({ batas: s.batas + b.batas, terpakai: s.terpakai + b.terpakai }), { batas: 0, terpakai: 0 })

  const targets: TargetTabungan[] = (tgt.data ?? []).map((t) => {
    const x = { id: t.id, nama: t.nama, target: Number(t.target), terkumpul: Number(t.terkumpul), tenggat: t.tenggat }
    return { ...x, info: infoTarget(x, hari) }
  })
  const rencana = ((ren.data ?? []) as unknown as { id: number; nama: string; nominal: number; tanggal: string; berulang: boolean; kategori: { nama: string } | null }[])
    .map((r) => ({ id: r.id, nama: r.nama, nominal: Number(r.nominal), tanggal: r.tanggal, berulang: r.berulang, kategori: r.kategori?.nama ?? null })) as Rencana[]

  return (
    <>
      <div><p className="text-xs text-slate-500">Atur anggaran, tabungan, dan pengeluaran besar sebelum terjadi. Rencana pengeluaran otomatis ikut dihitung di Prediksi.</p></div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
          <Anggaran baris={baris} kategoriKosong={kategori.filter((k) => !punya.has(k.id))} bulan={namaBulan(bulan)} total={total} />
          <RencanaBayar rencana={rencana} wallets={wallets} kategori={kategori} hariIni={hari} rencanaDulu={f.rencanaDulu} sebelum={f.next?.tanggal_perkiraan ?? null} />
        </div>
        <Target targets={targets} />
      </div>
    </>
  )
}
