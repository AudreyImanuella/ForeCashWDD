'use server'

// Aksi halaman Rencana: anggaran per kategori, target tabungan, rencana pengeluaran.
import { revalidatePath } from 'next/cache'
import { wajibLogin } from '@/lib/auth'
import { angka, gagal, sukses, teks, type Hasil } from '@/lib/aksi'
import { rupiah } from '@/lib/format'
import { hariIni, tambahBulan } from '@/lib/tanggal'

function segarkan() {
  revalidatePath('/rencana')
  revalidatePath('/beranda')
  revalidatePath('/prediksi')
  revalidatePath('/pencapaian')
}

const tanggalValid = (t: string) => /^\d{4}-\d{2}-\d{2}$/.test(t)

// ---------- anggaran ----------

/** Simpan batas anggaran satu kategori. Batas 0 / kosong = anggaran kategori itu dihapus. */
export async function simpanAnggaran(_prev: Hasil, fd: FormData): Promise<Hasil> {
  const { supabase, profil } = await wajibLogin('mahasiswa')
  const categoryId = angka(fd, 'category_id')
  const batas = Math.max(0, angka(fd, 'batas'))
  if (!categoryId) return gagal('Pilih kategori.')

  if (batas === 0) {
    await supabase.from('anggaran').delete().eq('user_id', profil.id).eq('category_id', categoryId)
    segarkan()
    return sukses('Anggaran kategori ini dihapus.')
  }
  const { error } = await supabase.from('anggaran')
    .upsert({ user_id: profil.id, category_id: categoryId, batas }, { onConflict: 'user_id,category_id' })
  if (error) return gagal('Gagal menyimpan: ' + error.message)
  segarkan()
  return sukses(`Anggaran ${rupiah(batas)} per bulan disimpan.`)
}

// ---------- target tabungan ----------

export async function tambahTarget(_prev: Hasil, fd: FormData): Promise<Hasil> {
  const { supabase, profil } = await wajibLogin('mahasiswa')
  const nama = teks(fd, 'nama').slice(0, 80)
  const target = angka(fd, 'target')
  const tenggat = teks(fd, 'tenggat')
  if (!nama || target <= 0) return gagal('Nama dan jumlah target wajib diisi.')
  if (tenggat && (!tanggalValid(tenggat) || tenggat <= hariIni())) return gagal('Tenggat harus setelah hari ini.')

  const { error } = await supabase.from('target_tabungan').insert({ user_id: profil.id, nama, target, tenggat: tenggat || null })
  if (error) return gagal('Gagal menyimpan: ' + error.message)
  segarkan()
  return sukses(`Target "${nama}" dibuat. Semangat menabung!`)
}

/** Tambah setoran ke target. Kalau terkumpul sudah mencapai target, tanggal tercapai dicatat. */
export async function setorTarget(_prev: Hasil, fd: FormData): Promise<Hasil> {
  const { supabase, profil } = await wajibLogin('mahasiswa')
  const id = angka(fd, 'id')
  const nominal = angka(fd, 'nominal')
  if (nominal <= 0) return gagal('Isi jumlah setoran.')

  const { data: t } = await supabase.from('target_tabungan').select('nama, target, terkumpul, tercapai_pada')
    .eq('id', id).eq('user_id', profil.id).maybeSingle()
  if (!t) return gagal('Target tidak ditemukan.')

  const terkumpul = Number(t.terkumpul) + nominal
  const baruTercapai = !t.tercapai_pada && terkumpul >= Number(t.target)
  const { error: e1 } = await supabase.from('setoran_tabungan').insert({ user_id: profil.id, target_id: id, nominal, tanggal: hariIni() })
  if (e1) return gagal('Gagal menyimpan setoran: ' + e1.message)
  const { error: e2 } = await supabase.from('target_tabungan')
    .update({ terkumpul, ...(baruTercapai ? { tercapai_pada: hariIni() } : {}) })
    .eq('id', id).eq('user_id', profil.id)
  if (e2) return gagal('Gagal memperbarui target: ' + e2.message)
  segarkan()
  return sukses(baruTercapai ? `Target "${t.nama}" TERCAPAI! Hebat!` : `Setoran ${rupiah(nominal)} masuk ke "${t.nama}".`)
}

export async function hapusTarget(_prev: Hasil, fd: FormData): Promise<Hasil> {
  const { supabase, profil } = await wajibLogin('mahasiswa')
  await supabase.from('target_tabungan').delete().eq('id', angka(fd, 'id')).eq('user_id', profil.id)
  segarkan()
  return sukses('Target dihapus.')
}

// ---------- rencana pengeluaran ----------

export async function tambahRencana(_prev: Hasil, fd: FormData): Promise<Hasil> {
  const { supabase, profil } = await wajibLogin('mahasiswa')
  const nama = teks(fd, 'nama').slice(0, 100)
  const nominal = angka(fd, 'nominal')
  const tanggal = teks(fd, 'tanggal')
  const categoryId = angka(fd, 'category_id') || null
  const berulang = teks(fd, 'berulang') !== ''
  if (!nama || nominal <= 0 || !tanggalValid(tanggal)) return gagal('Nama, nominal, dan tanggal wajib diisi.')

  const { error } = await supabase.from('rencana_pengeluaran')
    .insert({ user_id: profil.id, nama, nominal, tanggal, category_id: categoryId, berulang })
  if (error) return gagal('Gagal menyimpan: ' + error.message)
  segarkan()
  return sukses('Rencana disimpan dan ikut dihitung di Prediksi.')
}

/** Rencana sudah dibayar: dicatat sebagai pengeluaran. Rencana bulanan pindah ke bulan depan. */
export async function bayarRencana(_prev: Hasil, fd: FormData): Promise<Hasil> {
  const { supabase, profil } = await wajibLogin('mahasiswa')
  const id = angka(fd, 'id')
  const walletId = angka(fd, 'wallet_id')

  const { data: w } = await supabase.from('wallets').select('id').eq('id', walletId).eq('user_id', profil.id).maybeSingle()
  if (!w) return gagal('Pilih wallet untuk pembayaran.')
  const { data: r } = await supabase.from('rencana_pengeluaran').select('nama, nominal, tanggal, category_id, berulang, status')
    .eq('id', id).eq('user_id', profil.id).maybeSingle()
  if (!r || r.status !== 'rencana') return gagal('Rencana tidak ditemukan atau sudah dibayar.')

  // ubah rencana dulu (hanya kalau tanggalnya belum berubah), supaya klik dua kali tidak mencatat dua kali
  const ubah = r.berulang ? { tanggal: tambahBulan(r.tanggal) } : { status: 'selesai' }
  const { data: ok } = await supabase.from('rencana_pengeluaran').update(ubah)
    .eq('id', id).eq('user_id', profil.id).eq('status', 'rencana').eq('tanggal', r.tanggal).select('id').maybeSingle()
  if (!ok) return gagal('Rencana ini baru saja diperbarui. Muat ulang halaman.')

  const { error } = await supabase.from('transactions').insert({
    user_id: profil.id, wallet_id: walletId, category_id: r.category_id, jenis: 'pengeluaran',
    nominal: r.nominal, keterangan: r.nama.slice(0, 150), tanggal: hariIni(),
  })
  if (error) {
    await supabase.from('rencana_pengeluaran').update({ status: 'rencana', tanggal: r.tanggal }).eq('id', id).eq('user_id', profil.id)
    return gagal('Gagal mencatat transaksi: ' + error.message)
  }
  segarkan()
  revalidatePath('/transaksi')
  return sukses(r.berulang ? `Dicatat sebagai pengeluaran. Rencana berikutnya ${tambahBulan(r.tanggal)}.` : 'Dicatat sebagai pengeluaran.')
}

export async function hapusRencana(_prev: Hasil, fd: FormData): Promise<Hasil> {
  const { supabase, profil } = await wajibLogin('mahasiswa')
  await supabase.from('rencana_pengeluaran').delete().eq('id', angka(fd, 'id')).eq('user_id', profil.id)
  segarkan()
  return sukses('Rencana dihapus.')
}
