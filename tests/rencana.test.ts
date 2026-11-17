import test from 'node:test'
import assert from 'node:assert/strict'
import { infoTarget, ringkasAnggaran } from '../src/lib/rencana.ts'
import { tambahBulan } from '../src/lib/tanggal.ts'

test('anggaran: aman, hampir habis (>= 80%), lewat', () => {
  const r = ringkasAnggaran(
    [{ category_id: 1, nama: 'Makan', batas: 600000 }, { category_id: 2, nama: 'Ojek', batas: 200000 }, { category_id: 3, nama: 'Hiburan', batas: 100000 }],
    { 1: 300000, 2: 170000, 3: 120000 },
  )
  assert.deepEqual(r.map((x) => x.status), ['aman', 'hampir', 'lewat'])
  assert.equal(r[0].sisa, 300000)
  assert.equal(r[2].sisa, -20000)
  assert.equal(r[2].persen, 100)
})

test('target: saran setoran per minggu dibulatkan ke ribuan', () => {
  const i = infoTarget({ target: 750000, terkumpul: 450000, tenggat: '2026-12-30' }, '2026-11-18') // 42 hari = 6 minggu
  assert.equal(i.persen, 60)
  assert.equal(i.kurang, 300000)
  assert.equal(i.perMinggu, 50000)
})

test('target: tercapai dan telat', () => {
  assert.equal(infoTarget({ target: 100, terkumpul: 150, tenggat: null }, '2026-11-18').tercapai, true)
  const t = infoTarget({ target: 1000, terkumpul: 0, tenggat: '2026-11-01' }, '2026-11-18')
  assert.equal(t.telat, true)
  assert.equal(t.perMinggu, null)
})

test('tambahBulan: akhir bulan dan pergantian tahun', () => {
  assert.equal(tambahBulan('2026-11-05'), '2026-12-05')
  assert.equal(tambahBulan('2026-12-20'), '2027-01-20')
  assert.equal(tambahBulan('2026-01-31'), '2026-02-28')
})
