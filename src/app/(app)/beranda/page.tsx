// Beranda mahasiswa (port dari php-version/pages/dashboard.php).
import Link from 'next/link'
import { after } from 'next/server'
import { Coins, Flame, HandCoins, UserRoundMinus, Banknote, Landmark, Smartphone, ClipboardList, Target, BellRing } from 'lucide-react'
import WarningBanner from '@/components/WarningBanner'
import PetSvg from '@/components/PetSvg'
import { PETS } from '@/lib/pets'
import { LevelBar, Tantangan, sisaBadge } from '@/components/Gamifikasi'
import BadgeIkon from '@/components/BadgeIkon'
import BadgeBaru from '@/components/BadgeBaru'
import { TINGKAT } from '@/lib/gamify'
import { wajibLogin } from '@/lib/auth'
import { ambilForecast, ambilPetDipakai, ambilWallet, kategoriEmoji, type Jenis } from '@/lib/data'
import { emailStatusKritis } from '@/lib/email'
import { ambilGamify } from '@/lib/gamify'
import { rupiah } from '@/lib/format'
import { tgl } from '@/lib/tanggal'

export const metadata = { title: 'Dashboard' }

const IKON_WALLET = { tunai: Banknote, bank: Landmark, ewallet: Smartphone }
const KELAS_TX = { pemasukan: 'is-in', pengeluaran: 'is-out', transfer: 'is-move' }
const WARNA_TX = { pemasukan: 'text-hsGreen', pengeluaran: 'text-hsRed', transfer: 'text-hsBlue' }
const TANDA_TX = { pemasukan: '+', pengeluaran: '−', transfer: '' }

type TxTerakhir = {
  id: number; tanggal: string; jenis: Jenis; nominal: number; keterangan: string
  kategori: { nama: string } | null; wallet: { nama: string } | null; tujuan: { nama: string } | null
}

export default async function BerandaPage() {
  const { supabase, user, profil } = await wajibLogin('mahasiswa')
  const uid = profil.id

  const [wallets, teman] = await Promise.all([ambilWallet(supabase, uid), ambilPetDipakai(supabase, uid)])
  const [f, recent, debts] = await Promise.all([
    ambilForecast(supabase, uid, wallets),
    supabase
      .from('transactions')
      .select('id, tanggal, jenis, nominal, keterangan, kategori:categories(nama), wallet:wallets!transactions_wallet_id_fkey(nama), tujuan:wallets!transactions_wallet_tujuan_id_fkey(nama)')
      .eq('user_id', uid)
      .order('tanggal', { ascending: false })
      .order('id', { ascending: false })
      .limit(5),
    supabase.from('debts').select('arah, nominal').eq('user_id', uid).eq('status', 'belum'),
  ])
  // fitur Rencana & Teman (kosong kalau migrasi 000006 belum dijalankan)
  const [rencanaRes, targetRes, tagihanRes] = await Promise.all([
    supabase.from('rencana_pengeluaran').select('nama, nominal, tanggal').eq('user_id', uid).eq('status', 'rencana').order('tanggal').limit(1).maybeSingle(),
    supabase.from('target_tabungan').select('nama, target, terkumpul').eq('user_id', uid).is('tercapai_pada', null).order('created_at').limit(1).maybeSingle(),
    supabase.from('debts').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('arah', 'utang').eq('status', 'belum').not('teman_id', 'is', null),
  ])
  const rencanaDekat = rencanaRes.data
  const targetAktif = targetRes.data
  const tagihanTeman = tagihanRes.error ? 0 : tagihanRes.count ?? 0
  const g = await ambilGamify(supabase, uid, profil.batas_harian, f.status)
  const badgeDapat = g.badges.filter((b) => b.dapat).sort((a, b) => b.tingkat - a.tingkat)
  const transaksi = (recent.data ?? []) as unknown as TxTerakhir[]
  const total = (arah: string) => (debts.data ?? []).filter((d) => d.arah === arah).reduce((s, d) => s + Number(d.nominal), 0)
  const piutang = total('piutang')
  const utang = total('utang')

  // status Kritis: kirim email peringatan (maks. sekali sehari), setelah halaman selesai dikirim ke browser
  if (f.status === 'kritis' && user.email) {
    after(async () => {
      const { data: boleh } = await supabase.rpc('boleh_kirim_email_kritis')
      if (boleh) {
        await emailStatusKritis(user.email!, profil.nama, { saldo: f.saldo, habis: f.habis, batasAman: f.batasAman, sumber: f.next?.sumber ?? null })
      }
    })
  }

  return (
    <>
      <BadgeBaru uid={uid} badges={g.badges.map((b) => ({ key: b.key, nama: b.nama, tingkat: b.tingkat }))} />
      {tagihanTeman > 0 && (
        <Link href="/utang" className="fc-flash" style={{ background: '#E8F1FF', color: '#1E4FA8', borderColor: '#C7DBFF' }}>
          <BellRing size={18} /> Ada {tagihanTeman} tagihan dari teman ForeCash yang belum lunas. Lihat di Utang &amp; Patungan.
        </Link>
      )}
      <WarningBanner
        f={f}
        avatarId={profil.avatar}
        buddy={teman && (
          <Link href="/petualangan" className="fc-hero-buddy" title={`${PETS[teman]?.nama ?? 'Teman hemat'} menemanimu`}>
            <PetSvg id={teman} size={64} />
          </Link>
        )}
      />

      {/* Ringkasan angka */}
      <section className="fc-stats" aria-label="Ringkasan">
        <div className="hs-card fc-stat">
          <span className="fc-tile fc-tile-orange"><Coins size={20} /></span>
          <div className="min-w-0"><p className="fc-stat-label">Total saldo</p><p className="fc-stat-value">{rupiah(f.saldo)}</p></div>
        </div>
        <div className="hs-card fc-stat">
          <span className="fc-tile fc-tile-red"><Flame size={20} /></span>
          <div className="min-w-0">
            <p className="fc-stat-label">Pengeluaran per hari</p>
            <p className="fc-stat-value">{rupiah(f.burn)}</p>
            <p className="fc-stat-sub">rata-rata {f.hari} hari terakhir</p>
          </div>
        </div>
        <Link href="/utang" className="hs-card fc-stat">
          <span className="fc-tile fc-tile-green"><HandCoins size={20} /></span>
          <div className="min-w-0"><p className="fc-stat-label">Teman utang ke kamu</p><p className="fc-stat-value text-hsGreen">{rupiah(piutang)}</p></div>
        </Link>
        <Link href="/utang" className="hs-card fc-stat">
          <span className="fc-tile fc-tile-purple"><UserRoundMinus size={20} /></span>
          <div className="min-w-0"><p className="fc-stat-label">Kamu utang ke teman</p><p className="fc-stat-value text-hsRed">{rupiah(utang)}</p></div>
        </Link>
      </section>

      {/* Rencana terdekat & target tabungan */}
      {(rencanaDekat || targetAktif) && (
        <section className="fc-stats" aria-label="Rencana" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          {rencanaDekat && (
            <Link href="/rencana" className="hs-card fc-stat">
              <span className="fc-tile fc-tile-teal"><ClipboardList size={20} /></span>
              <div className="min-w-0">
                <p className="fc-stat-label">Rencana terdekat · {tgl(rencanaDekat.tanggal)}</p>
                <p className="fc-stat-value" style={{ fontSize: 18 }}>{rencanaDekat.nama} {rupiah(rencanaDekat.nominal)}</p>
                <p className="fc-stat-sub">{f.rencanaDulu > 0 ? 'Sudah dihitung di prediksi' : 'Jatuh setelah pemasukan berikutnya'}</p>
              </div>
            </Link>
          )}
          {targetAktif && (
            <Link href="/rencana" className="hs-card fc-stat">
              <span className="fc-tile fc-tile-pink"><Target size={20} /></span>
              <div className="min-w-0 flex-1">
                <p className="fc-stat-label">Target tabungan · {targetAktif.nama}</p>
                <p className="fc-stat-value" style={{ fontSize: 18 }}>{Math.min(100, Math.round((Number(targetAktif.terkumpul) / Number(targetAktif.target)) * 100))}% · {rupiah(targetAktif.terkumpul)}</p>
                <div className="w-full bg-slate-100 rounded-full h-2 mt-1"><div className="bg-pink-400 h-2 rounded-full" style={{ width: `${Math.min(100, Math.round((Number(targetAktif.terkumpul) / Number(targetAktif.target)) * 100))}%` }} /></div>
              </div>
            </Link>
          )}
        </section>
      )}

      {/* Aksi cepat */}
      <section aria-label="Catat cepat">
        <div className="fc-section-title"><h3>Mau catat apa?</h3></div>
        <div className="fc-actions">
          <Link href="/transaksi?jenis=pengeluaran#form" className="fc-action fc-action-out"><span className="fc-action-emoji">🍜</span><span><b>Pengeluaran</b><small>Jajan, ongkos, kos</small></span></Link>
          <Link href="/transaksi?jenis=pemasukan#form" className="fc-action fc-action-in"><span className="fc-action-emoji">💰</span><span><b>Pemasukan</b><small>Uang saku, gaji part-time</small></span></Link>
          <Link href="/transaksi?jenis=transfer#form" className="fc-action fc-action-move"><span className="fc-action-emoji">🔁</span><span><b>Transfer</b><small>Isi e-wallet dari rekening</small></span></Link>
          <Link href="/utang#split" className="fc-action fc-action-split"><span className="fc-action-emoji">🍕</span><span><b>Split bill</b><small>Bagi tagihan bareng teman</small></span></Link>
        </div>
      </section>

      {/* Gamifikasi: streak, level & badge, tantangan mingguan */}
      <section className="fc-game" aria-label="Pencapaian">
        <div className="hs-card fc-streak">
          <span className="fc-streak-flame"><Flame size={40} className="text-hsOrange" /></span>
          <div>
            <p className="fc-stat-value" style={{ fontSize: 30 }}>{g.streak} hari</p>
            <p className="fc-stat-sub">{g.streak ? 'berturut-turut mencatat' : 'Catat sesuatu hari ini untuk mulai streak'}</p>
          </div>
        </div>
        <div className="hs-card p-5">
          <LevelBar g={g} />
          <div className="mt-2 flex gap-1.5 flex-wrap">
            {badgeDapat.slice(0, 6).map((b) => <BadgeIkon key={b.key} ikon={b.icon} tingkat={b.tingkat} size={36} label={`${b.nama} ${TINGKAT[b.tingkat]}`} />)}
            {badgeDapat.length === 0 && <span className="text-xs text-slate-400">Belum ada badge</span>}
          </div>
          {g.hampir && (
            <p className="text-[11px] mt-2"><b className="text-hsOrange">Sedikit lagi:</b> {g.hampir.nama} {TINGKAT[g.hampir.tingkat + 1]} ({sisaBadge(g.hampir)})</p>
          )}
        </div>
        <Link href="/pencapaian" className="hs-card p-5 block">
          <Tantangan t={g.tantangan} />
          <p className="fc-link mt-2">Lihat semua pencapaian</p>
        </Link>
      </section>

      {/* Saldo per wallet */}
      <section aria-label="Saldo per wallet">
        <div className="fc-section-title">
          <div><h3>Dompetmu</h3><p>Semua transaksi otomatis masuk ke wallet &quot;Utama&quot; kalau tidak dipilih.</p></div>
          <Link href="/wallet" className="fc-link">Kelola wallet</Link>
        </div>
        <div className="fc-wallets">
          {wallets.map((w, i) => {
            const Ikon = IKON_WALLET[w.tipe]
            return (
              <div key={w.id} className={`wallet-card fc-w${i % 5}`}>
                <p className="flex items-center gap-2 text-sm font-bold"><span className="fc-wallet-icon"><Ikon size={17} /></span> {w.nama}</p>
                <p className="fc-stat-value">{rupiah(w.saldo)}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* Transaksi terakhir */}
      <section className="hs-card p-5" aria-label="Transaksi terakhir">
        <div className="fc-section-title" style={{ marginBottom: 4 }}>
          <h3 style={{ fontSize: 19 }}>Transaksi terakhir</h3>
          <Link href="/transaksi" className="fc-link">Lihat semua</Link>
        </div>
        {transaksi.length === 0 && <p className="text-sm text-slate-500 py-3">Belum ada transaksi. Mulai dari tombol &quot;Mau catat apa?&quot; di atas.</p>}
        {transaksi.map((t) => (
          <div key={t.id} className="fc-tx">
            <span className={`fc-tx-icon ${KELAS_TX[t.jenis]}`}>{kategoriEmoji(t.kategori?.nama, t.jenis)}</span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-sm truncate">{t.keterangan}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                <span className="fc-chip">{t.jenis === 'transfer' ? `${t.wallet?.nama} ke ${t.tujuan?.nama}` : t.kategori?.nama ?? 'Lainnya'}</span>{' '}
                {tgl(t.tanggal)}
              </p>
            </div>
            <p className={`font-display font-extrabold text-base ${WARNA_TX[t.jenis]}`}>
              {TANDA_TX[t.jenis]}{rupiah(t.nominal)}
            </p>
          </div>
        ))}
      </section>
    </>
  )
}
