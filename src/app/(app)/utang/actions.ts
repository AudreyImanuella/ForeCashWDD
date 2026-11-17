'use server'

// Aksi halaman Utang & Patungan (port dari blok "if POST" di php-version/pages/utang.php).
import { revalidatePath } from 'next/cache'
import { wajibLogin } from '@/lib/auth'
import { angka, gagal, sukses, teks, type Hasil } from '@/lib/aksi'
import { rupiah } from '@/lib/format'
import { hariIni } from '@/lib/tanggal'
import { bagianSplit, daftarTeman } from '@/lib/utang'

function tanggalOpsional(fd: FormData, nama: string): string | null {
  const t = teks(fd, nama)
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null
}

function segarkan() {
  revalidatePath('/utang')
  revalidatePath('/beranda')
  revalidatePath('/pencapaian')
}

/** Catat satu utang atau piutang. */
export async function catatUtang(_prev: Hasil, fd: FormData): Promise<Hasil> {
  const { supabase, profil } = await wajibLogin('mahasiswa')
  const nama = teks(fd, 'nama_teman').slice(0, 100)
  const keterangan = teks(fd, 'keterangan').slice(0, 150)
  const nominal = angka(fd, 'nominal')
  const arah = teks(fd, 'arah') === 'utang' ? 'utang' : 'piutang'
  const temanFc = teks(fd, 'teman_fc')
  if (temanFc && /^[0-9a-f-]{36}$/i.test(temanFc)) {
    if (!keterangan || nominal <= 0) return gagal('Keterangan dan nominal wajib diisi.')
    if (arah !== 'piutang') return gagal('Untuk teman ForeCash, catat "dia utang ke saya". Utangmu ke dia dicatat oleh temanmu.')
    const { error } = await supabase.rpc('kirim_tagihan', { p_teman: temanFc, p_keterangan: keterangan, p_nominal: nominal, p_jatuh_tempo: tanggalOpsional(fd, 'jatuh_tempo') })
    if (error) return gagal('Gagal mengirim tagihan: ' + error.message)
    segarkan()
    return sukses('Tagihan terkirim ke akun temanmu.')
  }
  if (!nama || !keterangan || nominal <= 0) return gagal('Nama teman, keterangan, dan nominal wajib diisi.')

  const { error } = await supabase.from('debts').insert({
    user_id: profil.id, nama_teman: nama, keterangan, nominal, arah, jatuh_tempo: tanggalOpsional(fd, 'jatuh_tempo'),
  })
  if (error) return gagal('Gagal menyimpan: ' + error.message)
  segarkan()
  return sukses('Catatan disimpan.')
}

/** Split bill: bagi total rata. Teman ForeCash langsung dikirimi tagihan (muncul di akun mereka),
 *  teman lain dicatat sebagai piutang biasa. */
export async function splitBill(_prev: Hasil, fd: FormData): Promise<Hasil> {
  const { supabase, profil } = await wajibLogin('mahasiswa')
  const total = angka(fd, 'total')
  const judul = teks(fd, 'judul').slice(0, 150) || 'Split bill'
  const teman = daftarTeman(teks(fd, 'teman'))
  const temanFc = [...new Set(fd.getAll('teman_fc').filter((v): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v)))]
  const ikut = teks(fd, 'termasuk_saya') !== ''
  const jumlah = teman.length + temanFc.length
  if (total <= 0 || jumlah === 0) return gagal('Isi total tagihan dan pilih minimal satu teman.')

  const per = bagianSplit(total, jumlah, ikut)
  const tempo = tanggalOpsional(fd, 'jatuh_tempo')

  for (const id of temanFc) {
    const { error } = await supabase.rpc('kirim_tagihan', { p_teman: id, p_keterangan: `Split bill: ${judul}`, p_nominal: per, p_jatuh_tempo: tempo })
    if (error) return gagal('Gagal mengirim tagihan: ' + error.message)
  }
  if (teman.length) {
    const { error } = await supabase.from('debts').insert(
      teman.map((nama) => ({ user_id: profil.id, nama_teman: nama, keterangan: judul, nominal: per, arah: 'piutang', jatuh_tempo: tempo })),
    )
    if (error) return gagal('Gagal menyimpan: ' + error.message)
  }
  segarkan()
  const kirim = temanFc.length ? ` ${temanFc.length} tagihan terkirim ke akun teman ForeCash.` : ''
  return sukses(`Split bill dibuat: ${rupiah(per)} per orang, ${jumlah} piutang tercatat.${kirim}`)
}

// ---------- Teman ForeCash ----------

export async function tambahTeman(_prev: Hasil, fd: FormData): Promise<Hasil> {
  const { supabase } = await wajibLogin('mahasiswa')
  const kode = teks(fd, 'kode').toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (kode.length !== 6) return gagal('Kode teman terdiri dari 6 huruf/angka.')
  const { data, error } = await supabase.rpc('tambah_teman', { kode })
  if (error) return gagal(error.message)
  segarkan()
  return sukses(`Sekarang kamu berteman dengan ${data?.[0]?.nama ?? 'temanmu'}.`)
}

export async function hapusTeman(_prev: Hasil, fd: FormData): Promise<Hasil> {
  const { supabase } = await wajibLogin('mahasiswa')
  const id = teks(fd, 'teman_id')
  if (!/^[0-9a-f-]{36}$/i.test(id)) return gagal('Teman tidak ditemukan.')
  const { error } = await supabase.rpc('hapus_teman', { p_teman: id })
  if (error) return gagal(error.message)
  segarkan()
  return sukses('Pertemanan diputus. Catatan utang yang sudah ada tetap tersimpan.')
}

/** Teman menandai lunas: saya tinggal mencatat transaksinya ke wallet (atau mengabaikan). */
export async function catatPelunasanTeman(_prev: Hasil, fd: FormData): Promise<Hasil> {
  const { supabase, profil } = await wajibLogin('mahasiswa')
  const id = angka(fd, 'id')
  const abaikan = teks(fd, 'abaikan') !== ''

  const { data: d } = await supabase.from('debts').update({ perlu_dicatat: false })
    .eq('id', id).eq('user_id', profil.id).eq('perlu_dicatat', true)
    .select('nama_teman, keterangan, nominal, arah').maybeSingle()
  if (!d) return gagal('Catatan tidak ditemukan.')
  if (abaikan) {
    segarkan()
    return sukses('Oke, tidak dicatat sebagai transaksi.')
  }

  const walletId = angka(fd, 'wallet_id')
  const { data: w } = await supabase.from('wallets').select('id').eq('id', walletId).eq('user_id', profil.id).maybeSingle()
  if (!w) {
    await supabase.from('debts').update({ perlu_dicatat: true }).eq('id', id).eq('user_id', profil.id)
    return gagal('Pilih wallet.')
  }
  const jenis = d.arah === 'piutang' ? 'pemasukan' : 'pengeluaran'
  const { data: kat } = await supabase.from('categories').select('id').is('user_id', null).eq('nama', 'Pelunasan Utang/Piutang').eq('jenis', jenis).maybeSingle()
  const { error } = await supabase.from('transactions').insert({
    user_id: profil.id, wallet_id: walletId, category_id: kat?.id ?? null, jenis,
    nominal: d.nominal, keterangan: `Pelunasan: ${d.nama_teman} - ${d.keterangan}`.slice(0, 150), tanggal: hariIni(),
  })
  if (error) {
    await supabase.from('debts').update({ perlu_dicatat: true }).eq('id', id).eq('user_id', profil.id)
    return gagal('Gagal mencatat transaksi: ' + error.message)
  }
  segarkan()
  revalidatePath('/transaksi')
  return sukses(`Dicatat sebagai ${jenis}.`)
}

/** Tandai lunas, lalu otomatis dicatat sebagai transaksi:
 *  pelunasan piutang = uang masuk (pemasukan), pelunasan utang = uang keluar (pengeluaran). */
export async function tandaiLunas(_prev: Hasil, fd: FormData): Promise<Hasil> {
  const { supabase, profil } = await wajibLogin('mahasiswa')
  const id = angka(fd, 'id')
  const walletId = angka(fd, 'wallet_id')

  const { data: w } = await supabase.from('wallets').select('id').eq('id', walletId).eq('user_id', profil.id).maybeSingle()
  if (!w) return gagal('Pilih wallet untuk pelunasan.')

  // ubah status dulu (hanya kalau masih "belum"), supaya klik dua kali tidak mencatat transaksi dua kali
  const { data: d } = await supabase
    .from('debts').update({ status: 'lunas' })
    .eq('id', id).eq('user_id', profil.id).eq('status', 'belum')
    .select('nama_teman, keterangan, nominal, arah').maybeSingle()
  if (!d) return gagal('Catatan tidak ditemukan atau sudah lunas.')

  const jenis = d.arah === 'piutang' ? 'pemasukan' : 'pengeluaran'
  const { data: kat } = await supabase
    .from('categories').select('id').is('user_id', null).eq('nama', 'Pelunasan Utang/Piutang').eq('jenis', jenis).maybeSingle()

  const { error } = await supabase.from('transactions').insert({
    user_id: profil.id, wallet_id: walletId, category_id: kat?.id ?? null, jenis,
    nominal: d.nominal, keterangan: `Pelunasan: ${d.nama_teman} - ${d.keterangan}`.slice(0, 150), tanggal: hariIni(),
  })
  if (error) {
    await supabase.from('debts').update({ status: 'belum' }).eq('id', id).eq('user_id', profil.id)
    return gagal('Gagal mencatat transaksi: ' + error.message)
  }
  // kalau ini tagihan dengan teman ForeCash, catatan di akun teman ikut lunas
  await supabase.rpc('sinkron_lunas', { p_id: id })
  segarkan()
  revalidatePath('/transaksi')
  return sukses(`Ditandai lunas dan dicatat sebagai ${jenis}.`)
}

export async function hapusUtang(_prev: Hasil, fd: FormData): Promise<Hasil> {
  const { supabase, profil } = await wajibLogin('mahasiswa')
  await supabase.from('debts').delete().eq('id', angka(fd, 'id')).eq('user_id', profil.id)
  segarkan()
  return sukses('Catatan dihapus.')
}
