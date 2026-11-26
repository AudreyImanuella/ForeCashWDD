'use client'

// Kerangka halaman setelah login.
// Desktop : sidebar oranye melayang, bisa diciutkan jadi ikon saja (diingat lewat cookie fc_side).
//           Menu aktif "menyatu" ke halaman (latar krem dengan lengkungan di kanan).
// HP      : tab bar bawah berisi 4 menu utama + tombol "Menu" yang membuka laci (drawer) berisi semua menu.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogOut, Eye, ChevronLeft, ChevronRight, LayoutGrid, X } from 'lucide-react'
import clsx from 'clsx'
import Avatar from '@/components/Avatar'
import Chatbot from '@/components/Chatbot'
import { MENU_MAHASISWA, MENU_ORANGTUA, JUDUL_HALAMAN } from '@/lib/navigation'
import { namaDepan } from '@/lib/format'

export type ShellUser = { nama: string; avatar: string; role: 'mahasiswa' | 'orangtua' }

type Props = {
  user: ShellUser
  /** contoh 'Jumat, 13 Nov 2026' (dihitung di server dalam WIB) */
  tanggal: string
  /** contoh 'Selamat pagi' */
  sapaan: string
  /** sidebar dalam keadaan ciut (dibaca dari cookie di server) */
  ciut?: boolean
  /** tombol keluar (form server action) */
  logout?: React.ReactNode
  children: React.ReactNode
}

/** Menu yang tampil di tab bar HP (sisanya ada di laci "Menu"). */
const TAB_HP = ['/beranda', '/transaksi', '/utang', '/rencana', '/pantau']

export default function AppShell({ user, tanggal, sapaan, ciut: ciutAwal = false, logout, children }: Props) {
  const pathname = usePathname()
  const [ciut, setCiut] = useState(ciutAwal)
  const [laci, setLaci] = useState(false)

  const menus = user.role === 'orangtua' ? MENU_ORANGTUA : MENU_MAHASISWA
  const home = menus[0].href
  // halaman tanpa menu sendiri ikut menyalakan menu induknya (Kelola Wallet -> Beranda)
  const induk: Record<string, string> = { '/wallet': '/beranda' }
  const path = induk[pathname] ?? pathname
  const aktif = (href: string) => path === href || path.startsWith(href + '/')
  const judul = pathname === '/beranda' ? `${sapaan}, ${namaDepan(user.nama)}!` : JUDUL_HALAMAN[pathname] ?? 'ForeCash'
  const tabHp = menus.filter((m) => TAB_HP.includes(m.href)).slice(0, 4)
  const laciAktif = !tabHp.some((m) => aktif(m.href))

  function gantiCiut() {
    const baru = !ciut
    setCiut(baru)
    document.cookie = `fc_side=${baru ? 'ciut' : 'lebar'}; path=/; max-age=31536000; samesite=lax`
  }

  // laci HP: tutup dengan Esc, kunci scroll halaman selama terbuka
  useEffect(() => {
    if (!laci) return
    const tutup = (e: KeyboardEvent) => { if (e.key === 'Escape') setLaci(false) }
    document.addEventListener('keydown', tutup)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', tutup)
      document.body.style.overflow = ''
    }
  }, [laci])

  const tutupLaci = () => setLaci(false)

  return (
    <div className={clsx('fc-body', ciut && 'is-ciut')}>
      {laci && <div className="fc-scrim" onClick={tutupLaci} aria-hidden />}

      {/* ===== Sidebar (desktop) / laci (HP) ===== */}
      <aside className={clsx('fc-side', laci && 'is-open')} aria-label="Menu utama">
        {/* kepala sidebar: langit oranye + awan + maskot */}
        <div className="fc-side-head">
          <Link href={home} className="fc-brand" onClick={tutupLaci} title="ForeCash">
            <span className="fc-brand-badge">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.svg" alt="" />
            </span>
            <span className="fc-nav-label min-w-0">
              <span className="fc-brand-name">ForeCash</span>
              <span className="fc-brand-tag">Uang aman sampai kiriman berikutnya</span>
            </span>
          </Link>
          <button type="button" className="fc-side-toggle" onClick={gantiCiut} aria-label={ciut ? 'Lebarkan menu' : 'Ciutkan menu'} title={ciut ? 'Lebarkan menu' : 'Ciutkan menu'}>
            <ChevronLeft size={16} strokeWidth={2.75} />
          </button>
          <button type="button" className="fc-side-close" onClick={tutupLaci} aria-label="Tutup menu">
            <X size={18} strokeWidth={2.75} />
          </button>
          <svg className="fc-side-cloud" viewBox="0 0 240 28" preserveAspectRatio="none" aria-hidden>
            <path d="M0 28V14c10-8 22-9 32-2 8-10 24-12 34-3 9-9 25-9 33 1 10-8 25-7 33 3 9-7 23-7 31 2 10-9 26-9 35 0 8-6 18-7 26-1 7-4 13-4 16-2V28Z" />
          </svg>
          <span className="fc-spark fc-spark-1" aria-hidden />
          <span className="fc-spark fc-spark-2" aria-hidden />
        </div>

        <p className="fc-nav-label fc-nav-title">Mau ngapain hari ini?</p>
        <nav className="fc-nav">
          {menus.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              onClick={tutupLaci}
              title={m.label}
              className={clsx('fc-nav-item', `fc-ic-${m.warna}`, aktif(m.href) && 'is-active')}
              aria-current={aktif(m.href) ? 'page' : undefined}
            >
              <span className="fc-nav-icon"><m.icon size={18} strokeWidth={2.4} /></span>
              <span className="fc-nav-label fc-nav-text">{m.label}</span>
              <span className="fc-nav-label fc-nav-go" aria-hidden><ChevronRight size={14} strokeWidth={3} /></span>
            </Link>
          ))}
        </nav>

        <div className="fc-side-foot">
          <Link
            href="/akun"
            onClick={tutupLaci}
            title="Akun"
            className={clsx('fc-me', aktif('/akun') && 'is-active')}
          >
            <span className="fc-me-avatar"><Avatar id={user.avatar} size={40} /></span>
            <span className="fc-nav-label min-w-0">
              <span className="fc-me-name">{user.nama}</span>
              <span className="fc-me-role">{user.role === 'orangtua' ? 'Orang tua' : 'Mahasiswa'} · Akun</span>
            </span>
          </Link>
          {logout ?? (
            <Link href="/login" className="fc-logout" title="Keluar">
              <LogOut size={16} strokeWidth={2.4} /> <span className="fc-nav-label">Keluar</span>
            </Link>
          )}
        </div>
      </aside>

      <div className="fc-main">
        {user.role === 'orangtua' && (
          <div className="fc-parent-strip">
            <Eye size={14} className="inline -mt-0.5" /> Mode pantau: data anak hanya bisa dilihat, tidak bisa diubah.
          </div>
        )}

        <header className="fc-top">
          <Link href={home} className="fc-top-logo" aria-label="ForeCash">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="" />
          </Link>
          <div className="min-w-0">
            <p className="fc-top-date">{tanggal}</p>
            <h1 className="fc-top-title">{judul}</h1>
          </div>
          <Link href="/akun" className="fc-top-avatar" aria-label="Akun">
            <Avatar id={user.avatar} size={40} />
          </Link>
        </header>

        <main className="fc-content">{children}</main>
      </div>

      {/* ForeCash Assistant (khusus mahasiswa) */}
      {user.role === 'mahasiswa' && <Chatbot nama={namaDepan(user.nama)} />}

      {/* ===== Tab bar bawah (HP): 4 menu utama + Menu ===== */}
      <nav className="fc-tabbar" aria-label="Menu cepat">
        {tabHp.map((m) => (
          <Link key={m.href} href={m.href} className={clsx(`fc-ic-${m.warna}`, aktif(m.href) && 'is-active')} aria-current={aktif(m.href) ? 'page' : undefined}>
            <span className="fc-tab-ic"><m.icon size={19} strokeWidth={2.4} /></span>
            <span>{m.pendek}</span>
          </Link>
        ))}
        <button type="button" onClick={() => setLaci(true)} className={clsx('fc-ic-orange', laciAktif && 'is-active')} aria-label="Semua menu" aria-expanded={laci}>
          <span className="fc-tab-ic"><LayoutGrid size={19} strokeWidth={2.4} /></span>
          <span>Menu</span>
        </button>
      </nav>
    </div>
  )
}
