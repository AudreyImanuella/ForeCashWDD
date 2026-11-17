// Layout untuk semua halaman setelah login (folder (app) tidak muncul di URL).
import { cookies } from 'next/headers'
import { LogOut } from 'lucide-react'
import AppShell from '@/components/layout/AppShell'
import { wajibLogin } from '@/lib/auth'
import { keluar } from '@/lib/actions/auth'
import { hariIni, jamSekarang, tglPanjang, sapaan } from '@/lib/tanggal'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profil } = await wajibLogin()
  // sidebar ciut (ikon saja) diingat lewat cookie supaya tidak berkedip saat halaman dimuat
  const ciut = (await cookies()).get('fc_side')?.value === 'ciut'

  return (
    <AppShell
      user={{ nama: profil.nama, avatar: profil.avatar, role: profil.role }}
      tanggal={tglPanjang(hariIni())}
      sapaan={sapaan(jamSekarang())}
      ciut={ciut}
      logout={
        <form action={keluar}>
          <button className="fc-logout" title="Keluar">
            <LogOut size={16} strokeWidth={2.2} /> <span className="fc-nav-label">Keluar</span>
          </button>
        </form>
      }
    >
      {children}
    </AppShell>
  )
}
