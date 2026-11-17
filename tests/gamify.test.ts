import test from 'node:test'
import assert from 'node:assert/strict'
import { gamify, hitungStreak, mingguBeruntun, seninMingguIni, streakTerpanjang, tantanganMingguIni, type GamifyInput } from '../src/lib/gamify.ts'
import { tambahHari } from '../src/lib/tanggal.ts'

const HARI = '2026-11-13' // Jumat
const h = (n: number) => tambahHari(HARI, n)

function input(over: Partial<GamifyInput> = {}): GamifyInput {
  return {
    hariIni: HARI, tanggalTransaksi: [], jumlahTransaksi: 0, batasHarian: 0, pengeluaranPerHari: {},
    status: 'waspada', makanMingguIni: 0, ...over,
  }
}

test('streak: dihitung mundur dari hari ini', () => {
  assert.equal(hitungStreak([HARI, h(-1), h(-2), h(-4)], HARI), 3)
})

test('streak: boleh belum mencatat hari ini (mulai dari kemarin)', () => {
  assert.equal(hitungStreak([h(-1), h(-2)], HARI), 2)
})

test('streak: putus kalau kemarin juga tidak mencatat', () => {
  assert.equal(hitungStreak([h(-2), h(-3)], HARI), 0)
})

test('senin minggu ini (minggu Senin–Minggu)', () => {
  assert.equal(seninMingguIni('2026-11-13'), '2026-11-09') // Jumat -> Senin
  assert.equal(seninMingguIni('2026-11-15'), '2026-11-09') // Minggu -> Senin sebelumnya
  assert.equal(seninMingguIni('2026-11-16'), '2026-11-16') // Senin -> hari itu
})

const badge = (g: ReturnType<typeof gamify>, key: string) => g.badges.find((b) => b.key === key)!

test('badge bertingkat: perunggu, perak, emas', () => {
  assert.equal(badge(gamify(input({ jumlahTransaksi: 9 })), 'pencatat').tingkat, 0)
  assert.equal(badge(gamify(input({ jumlahTransaksi: 10 })), 'pencatat').tingkat, 1)
  assert.equal(badge(gamify(input({ jumlahTransaksi: 60 })), 'pencatat').tingkat, 2)
  const emas = badge(gamify(input({ jumlahTransaksi: 500 })), 'pencatat')
  assert.equal(emas.tingkat, 3)
  assert.equal(emas.berikut, null)
  assert.equal(emas.persen, 100)
})

test('kemajuan menuju tingkat berikutnya dihitung dari ambang sebelumnya', () => {
  const b = badge(gamify(input({ jumlahTransaksi: 30 })), 'pencatat') // perunggu 10, perak 50
  assert.equal(b.tingkat, 1)
  assert.equal(b.berikut, 50)
  assert.equal(b.persen, 50)
})

test('membuka aplikasi saja tidak memberi badge apa pun', () => {
  const g = gamify(input({ status: 'aman' }))
  assert.equal(g.badges.filter((b) => b.dapat).length, 0)
  assert.equal(g.poin, 0)
  assert.equal(g.level, 1)
})

test('poin & level: perunggu 50, perak 150, emas 350 + streak 10/hari', () => {
  const g = gamify(input({
    tanggalTransaksi: [HARI, h(-1), h(-2), h(-3), h(-4)], // streak 5 -> Rajin perunggu (3)
    jumlahTransaksi: 60, // Pencatat perak
    totalSetoran: 2000000, // Penabung emas
  }))
  assert.equal(g.streak, 5)
  assert.equal(g.poin, 50 + 150 + 350 + 50)
  assert.equal(g.level, 2)
  assert.equal(g.levelNama, 'Hemat Muda')
  assert.equal(g.nextPoin, 800)
})

test('rekor streak tetap dihitung walau streak sekarang putus', () => {
  assert.equal(streakTerpanjang([h(-20), h(-19), h(-18), h(-17), h(-10), h(-9)]), 4)
  const g = gamify(input({ tanggalTransaksi: Array.from({ length: 8 }, (_, k) => h(-20 + k)) }))
  assert.equal(g.streak, 0)
  assert.equal(badge(g, 'rajin').tingkat, 2) // rekor 8 hari >= 7
})

test('hari hemat: 30 hari terakhir, hari tanpa pengeluaran juga hemat', () => {
  const g = gamify(input({ batasHarian: 50000, pengeluaranPerHari: { [HARI]: 60000, [h(-1)]: 40000 } }))
  assert.equal(badge(g, 'hemat').nilai, 29)
  assert.equal(badge(g, 'hemat').tingkat, 3)
  assert.equal(badge(gamify(input({ batasHarian: 0 })), 'hemat').nilai, 0)
})

test('nabung rutin: minggu berturut-turut ada setoran', () => {
  assert.equal(mingguBeruntun([h(-1), h(-8), h(-15)], HARI), 3)
  assert.equal(mingguBeruntun([h(-8), h(-15)], HARI), 2) // minggu ini belum setor: dihitung dari minggu lalu
  assert.equal(mingguBeruntun([h(-22)], HARI), 0)
})

test('"hampir dapat" memilih badge yang paling dekat naik tingkat', () => {
  const g = gamify(input({ jumlahTransaksi: 9, jumlahTeman: 2 })) // pencatat 90%, lingkaran (1->3) 50%
  assert.equal(g.hampir?.key, 'pencatat')
})

test('senin minggu ini (minggu Senin–Minggu)', () => {
  assert.equal(seninMingguIni('2026-11-13'), '2026-11-09')
  assert.equal(seninMingguIni('2026-11-16'), '2026-11-16')
})

test('tantangan mingguan bergilir dan sisa hari sampai Minggu', () => {
  const judul = new Set([0, 7, 14].map((n) => tantanganMingguIni(input({ hariIni: tambahHari(HARI, n), batasHarian: 50000 })).judul))
  assert.equal(judul.size, 3)
  assert.equal(tantanganMingguIni(input()).sisaHari, 2) // Jumat -> Sabtu, Minggu
})

test('tantangan catat 5 hari: gagal kalau sisa hari tidak cukup', () => {
  // cari minggu yang tantangannya "catat 5 hari"
  let hari = HARI
  while (!tantanganMingguIni(input({ hariIni: hari })).judul.startsWith('Catat')) hari = tambahHari(hari, 7)
  const jumat = tambahHari(hari, 5 - (new Date(hari + 'T00:00:00Z').getUTCDay() || 7))
  const t = tantanganMingguIni(input({ hariIni: jumat, tanggalTransaksi: [jumat] }))
  assert.equal(t.now, 1)
  assert.equal(t.gagal, true) // 1 + 2 hari tersisa < 5
})
