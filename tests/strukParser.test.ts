// Parser struk: contoh teks mirip hasil OCR struk Indonesia.
import test from 'node:test'
import assert from 'node:assert/strict'
import { angkaRupiah, bacaTeksStruk } from '../src/lib/strukParser.ts'

test('format angka rupiah: titik/koma ribuan dan pecahan', () => {
  assert.equal(angkaRupiah('45.000'), 45000)
  assert.equal(angkaRupiah('Rp 45.000'), 45000)
  assert.equal(angkaRupiah('Rp45000'), 45000)
  assert.equal(angkaRupiah('45.000,00'), 45000)
  assert.equal(angkaRupiah('45,000.00'), 45000)
  assert.equal(angkaRupiah('1.250.000'), 1250000)
  assert.equal(angkaRupiah('abc'), null)
})

const INDOMARET = `
INDOMARET CIPETE RAYA
JL. CIPETE RAYA NO 10 JAKARTA
NPWP 01.234.567.8-012.000
17/11/2026 14:32  KASIR 02
AQUA 600ML      2   7.000
ROTI TAWAR        1  16.500
TOTAL ITEM 3
SUB TOTAL          23.500
PPN                 2.136
TOTAL              23.500
TUNAI              50.000
KEMBALI            26.500
TERIMA KASIH
`

test('struk minimarket: ambil TOTAL, bukan tunai/kembalian', () => {
  const h = bacaTeksStruk(INDOMARET)
  assert.equal(h.nominal, 23500)
  assert.equal(h.yakin, 'tinggi')
  assert.equal(h.tanggal, '2026-11-17')
  assert.equal(h.toko, 'Indomaret Cipete Raya')
})

test('struk restoran: GRAND TOTAL lebih diutamakan dari subtotal', () => {
  const h = bacaTeksStruk(`
Warung Bakso Pak Kumis
Tgl: 15 Nov 2026
Bakso Urat      2   40.000
Es Teh          2   10.000
Subtotal             50.000
Service 5%            2.500
PB1 10%               5.250
GRAND TOTAL     Rp 57.750
Cash                 60.000
`)
  assert.equal(h.nominal, 57750)
  assert.equal(h.tanggal, '2026-11-15')
  assert.equal(h.kategori, 'Makan & Minum')
})

test('angka total di baris berikutnya (kolom terpisah)', () => {
  const h = bacaTeksStruk('Toko Maju\nTOTAL BAYAR\nRp 128.000\nTUNAI 150.000')
  assert.equal(h.nominal, 128000)
  assert.equal(h.yakin, 'tinggi')
})

test('salah baca OCR: O dibaca sebagai 0 dan l sebagai 1', () => {
  const h = bacaTeksStruk('Kantin Kampus\nTOTAL   l5.OOO\nTUNAI 20.000')
  assert.equal(h.nominal, 15000)
})

test('tanpa kata TOTAL: tebak angka terbesar dan tandai yakin rendah', () => {
  const h = bacaTeksStruk('Fotokopi Berkah\nJilid 1  5.000\nFotokopi 40  12.000\n17-11-26')
  assert.equal(h.nominal, 12000)
  assert.equal(h.yakin, 'rendah')
  assert.equal(h.kategori, 'Kebutuhan Kuliah')
  assert.equal(h.tanggal, '2026-11-17')
})

test('nomor telepon/NPWP/barcode panjang tidak dianggap nominal', () => {
  const h = bacaTeksStruk('Toko ABC\nTelp 081234567890\nNPWP 012345678012000\nNo 8991234567890')
  assert.equal(h.nominal, null)
  assert.equal(h.yakin, 'tidak')
})

test('tanggal tidak valid diabaikan, format bulan Indonesia dikenali', () => {
  assert.equal(bacaTeksStruk('Toko\n31/02/2026\nTOTAL 10.000').tanggal, null)
  assert.equal(bacaTeksStruk('Toko\n3 Agustus 2026\nTOTAL 10.000').tanggal, '2026-08-03')
  assert.equal(bacaTeksStruk('Toko\n2026-11-09 10:00\nTOTAL 10.000').tanggal, '2026-11-09')
})

test('kategori transportasi dari SPBU', () => {
  assert.equal(bacaTeksStruk('PERTAMINA SPBU 34.123\nPERTALITE 5 L\nTOTAL 50.000').kategori, 'Transportasi')
})

test('teks kosong aman', () => {
  const h = bacaTeksStruk('')
  assert.deepEqual(h, { nominal: null, yakin: 'tidak', tanggal: null, toko: null, kategori: null })
})
