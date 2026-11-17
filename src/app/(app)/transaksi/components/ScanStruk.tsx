'use client'

// Scan struk: foto dipilih → dikompres → teksnya dibaca di browser (tesseract.js, tanpa API berbayar)
// → total/tanggal/toko diambil → langsung disimpan sebagai pengeluaran lewat Server Action.
// Hasilnya selalu bisa dikoreksi lewat tombol "Ubah".
import { useRef, useState } from 'react'
import Link from 'next/link'
import { Camera, LoaderCircle, Pencil } from 'lucide-react'
import Flash from '@/components/Flash'
import { rupiah } from '@/lib/format'
import { bacaTeksStruk } from '@/lib/strukParser'
import { STRUK_MAX } from '@/lib/struk'
import { hariIni, tgl } from '@/lib/tanggal'
import { simpanDariScan } from '../actions'
import { BATAS_KONFIRMASI, type OpsiKategori, type OpsiWallet } from './TxForm'

const SISI_MAKS = 1800 // piksel sisi terpanjang; cukup tajam untuk dibaca, file tetap kecil

type Tersimpan = { id: number; nominal: number; keterangan: string; kategori: string; tanggal: string }

/** Muat gambar dengan orientasi EXIF yang benar (foto HP sering miring). */
async function muatGambar(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return await new Promise((ok, err) => {
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => { URL.revokeObjectURL(url); ok(img) }
      img.onerror = () => { URL.revokeObjectURL(url); err(new Error('gambar')) }
      img.src = url
    })
  }
}

function gambarKeCanvas(img: ImageBitmap | HTMLImageElement): HTMLCanvasElement {
  const w0 = 'naturalWidth' in img ? img.naturalWidth : img.width
  const h0 = 'naturalHeight' in img ? img.naturalHeight : img.height
  const skala = Math.min(1, SISI_MAKS / Math.max(w0, h0))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w0 * skala))
  c.height = Math.max(1, Math.round(h0 * skala))
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  return c
}

/** Abu-abu + regangkan kontras supaya tulisan struk thermal yang pudar lebih mudah dibaca OCR. */
function untukOcr(sumber: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = sumber.width
  c.height = sumber.height
  const ctx = c.getContext('2d')!
  ctx.drawImage(sumber, 0, 0)
  const data = ctx.getImageData(0, 0, c.width, c.height)
  const px = data.data
  const hist = new Uint32Array(256)
  for (let i = 0; i < px.length; i += 4) {
    const g = Math.round(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2])
    px[i] = g
    hist[g]++
  }
  const total = px.length / 4
  let lo = 0, hi = 255, acc = 0
  for (let g = 0; g < 256; g++) { acc += hist[g]; if (acc >= total * 0.02) { lo = g; break } }
  acc = 0
  for (let g = 255; g >= 0; g--) { acc += hist[g]; if (acc >= total * 0.02) { hi = g; break } }
  const rentang = Math.max(1, hi - lo)
  for (let i = 0; i < px.length; i += 4) {
    const g = Math.max(0, Math.min(255, ((px[i] - lo) * 255) / rentang))
    px[i] = px[i + 1] = px[i + 2] = g
  }
  ctx.putImageData(data, 0, 0)
  return c
}

/** JPEG di bawah batas 2 MB (kualitas diturunkan bertahap kalau perlu). */
async function keJpeg(canvas: HTMLCanvasElement): Promise<File | null> {
  for (const q of [0.82, 0.7, 0.55, 0.4]) {
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', q))
    if (blob && blob.size <= STRUK_MAX) return new File([blob], 'struk.jpg', { type: 'image/jpeg' })
  }
  return null
}

export default function ScanStruk({ wallets, kategori }: { wallets: OpsiWallet[]; kategori: OpsiKategori[] }) {
  const [walletId, setWalletId] = useState(wallets[0]?.id ?? 0)
  const [sibuk, setSibuk] = useState(false)
  const [langkah, setLangkah] = useState('')
  const [persen, setPersen] = useState(0)
  const [galat, setGalat] = useState<string | null>(null)
  const [simpan, setSimpan] = useState<Tersimpan | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function proses(file: File) {
    setGalat(null)
    setSimpan(null)
    if (!file.type.startsWith('image/')) return setGalat('File harus berupa foto (JPG, PNG, atau WEBP).')
    if (file.size > 25 * 1024 * 1024) return setGalat('Foto terlalu besar (maks. 25 MB).')
    if (!walletId) return setGalat('Buat wallet dulu sebelum scan struk.')

    setSibuk(true)
    setPersen(0)
    try {
      setLangkah('Menyiapkan foto...')
      const canvas = gambarKeCanvas(await muatGambar(file))
      const jpeg = await keJpeg(canvas)
      if (!jpeg) return setGalat('Foto terlalu besar untuk disimpan. Coba foto yang lebih kecil.')

      setLangkah('Membaca struk...')
      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker('eng', 1, {
        logger: (m) => { if (m.status === 'recognizing text') setPersen(Math.round(m.progress * 100)) },
      })
      let teks = ''
      try {
        teks = (await worker.recognize(untukOcr(canvas))).data.text
      } finally {
        await worker.terminate()
      }

      const h = bacaTeksStruk(teks)
      if (h.nominal == null) {
        return setGalat('Total belanja tidak terbaca. Coba foto lagi dari dekat, lurus, dan terang, atau catat manual lewat form di bawah.')
      }
      if (h.yakin === 'rendah' && !confirm(`Kata "TOTAL" tidak terbaca jelas.\nTebakan total: ${rupiah(h.nominal)}\n\nSimpan dengan nominal ini?`)) return
      if (h.nominal >= BATAS_KONFIRMASI && !confirm(`Yakin nominalnya ${rupiah(h.nominal)}?\n\nPeriksa lagi jumlah angka nolnya sebelum menyimpan.`)) return

      const keluar = kategori.filter((k) => k.jenis === 'pengeluaran')
      const cocok = keluar.find((k) => k.nama === h.kategori) ?? keluar.find((k) => k.nama === 'Lainnya') ?? keluar[0]
      if (!cocok) return setGalat('Belum ada kategori pengeluaran.')
      const hari = hariIni()
      const tanggal = h.tanggal && h.tanggal <= hari ? h.tanggal : hari
      const keterangan = (h.toko ?? 'Belanja (scan struk)').slice(0, 150)

      setLangkah('Menyimpan...')
      const fd = new FormData()
      fd.set('bukti', jpeg)
      fd.set('nominal', String(h.nominal))
      fd.set('keterangan', keterangan)
      fd.set('tanggal', tanggal)
      fd.set('wallet_id', String(walletId))
      fd.set('category_id', String(cocok.id))
      const r = await simpanDariScan(fd)
      if (r.error || !r.id) return setGalat(r.error ?? 'Gagal menyimpan. Coba lagi.')
      setSimpan({ id: r.id, nominal: h.nominal, keterangan, kategori: cocok.nama, tanggal })
    } catch {
      setGalat('Gagal membaca struk. Pastikan internet aktif (pembaca teks diunduh saat pertama kali dipakai), lalu coba lagi.')
    } finally {
      setSibuk(false)
      setLangkah('')
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="hs-card p-5 space-y-3">
      <h4 className="text-sm font-black"><Camera size={15} className="inline -mt-0.5 text-hsOrange" /> Scan Struk</h4>
      <p className="text-xs text-slate-500">Foto struk belanja, total dan tanggalnya dibaca otomatis lalu langsung tersimpan sebagai pengeluaran.</p>
      <Flash hasil={galat ? { error: galat } : null} />

      {simpan && (
        <div className="fc-flash" role="status">
          <div className="flex items-center gap-3 w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/transaksi/struk/${simpan.id}`} alt="Struk tersimpan" className="w-14 h-14 object-cover rounded-xl border shrink-0" />
            <div className="min-w-0 flex-1 text-xs">
              <p className="font-black text-sm truncate">{simpan.keterangan}</p>
              <p>{rupiah(simpan.nominal)} · {simpan.kategori} · {tgl(simpan.tanggal)}</p>
              <p className="text-slate-500">Tersimpan. Periksa, kalau ada yang salah:</p>
            </div>
            <Link href={`/transaksi/${simpan.id}/ubah`} className="hs-btn bg-slate-800 text-white px-3 py-2 text-xs shrink-0">
              <Pencil size={13} /> Ubah
            </Link>
          </div>
        </div>
      )}

      <div>
        <label htmlFor="scan_wallet" className="text-xs font-bold">Masuk ke wallet</label>
        <select id="scan_wallet" value={walletId} onChange={(e) => setWalletId(Number(e.target.value))} disabled={sibuk} className="w-full px-3 py-2.5 text-sm border">
          {wallets.map((w) => <option key={w.id} value={w.id}>{w.nama} ({rupiah(w.saldo)})</option>)}
        </select>
      </div>

      <label className={`flex flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-slate-300 px-4 py-6 text-center text-xs font-bold focus-within:ring-2 focus-within:ring-hsOrange ${sibuk ? 'opacity-70' : 'cursor-pointer hover:bg-slate-50'}`}>
        <input ref={inputRef} type="file" accept="image/*" disabled={sibuk} className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void proses(f) }} />
        {sibuk ? (
          <>
            <LoaderCircle size={22} className="animate-spin text-hsOrange" />
            <span>{langkah}{langkah === 'Membaca struk...' && persen > 0 ? ` ${persen}%` : ''}</span>
            <span className="font-normal text-slate-500">Pertama kali bisa agak lama karena mengunduh pembaca teks.</span>
          </>
        ) : (
          <>
            <Camera size={22} className="text-hsOrange" />
            <span>Ambil foto atau pilih gambar struk</span>
            <span className="font-normal text-slate-500">Pastikan struk lurus, terang, dan tulisannya jelas.</span>
          </>
        )}
      </label>
    </div>
  )
}
