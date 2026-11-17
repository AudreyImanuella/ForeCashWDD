import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bacaNominal, ribuan, rupiah } from '../src/lib/format.ts'

test('bacaNominal membaca format Indonesia', () => {
  assert.equal(bacaNominal('25.000'), 25000)
  assert.equal(bacaNominal('25000'), 25000)
  assert.equal(bacaNominal('Rp 1.250.000'), 1250000)
  assert.equal(bacaNominal('12.500,50'), 12500.5)
  assert.ok(Number.isNaN(bacaNominal('')))
  assert.ok(Number.isNaN(bacaNominal('abc')))
})

test('ribuan menambah titik', () => {
  assert.equal(ribuan('1250000'), '1.250.000')
  assert.equal(ribuan('25.0005'), '250.005')
  assert.equal(ribuan('000'), '0')
  assert.equal(ribuan(''), '')
  assert.equal(rupiah(1250000), 'Rp 1.250.000')
})
