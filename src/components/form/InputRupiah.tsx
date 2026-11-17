'use client'

// Kolom uang dengan titik ribuan otomatis: ketik 25000 -> tampil "25.000".
// Yang dikirim ke server tetap teks "25.000"; server membacanya dengan bacaNominal().
// Bisa uncontrolled (defaultValue, ikut ter-reset bersama form) atau controlled (value + onValueChange, berisi digit saja).
import clsx from 'clsx'
import { ribuan } from '@/lib/format'

type Props = {
  id?: string
  name?: string
  required?: boolean
  placeholder?: string
  'aria-label'?: string
  defaultValue?: number | string | null
  /** controlled: digit mentah, contoh '25000' */
  value?: string
  onValueChange?: (digit: string) => void
  /** ukuran: 'md' untuk form utama, 'sm' untuk form kecil */
  size?: 'sm' | 'md'
  className?: string
}

export default function InputRupiah({ defaultValue, value, onValueChange, size = 'sm', className, placeholder = '0', ...rest }: Props) {
  const controlled = value !== undefined
  const awal = defaultValue === null || defaultValue === undefined || defaultValue === '' ? '' : ribuan(String(Math.round(Number(defaultValue))))

  function ketik(e: React.ChangeEvent<HTMLInputElement>) {
    const el = e.currentTarget
    const digit = el.value.replace(/\D/g, '').slice(0, 13)
    if (controlled) {
      onValueChange?.(digit)
      return
    }
    // jaga posisi kursor: hitung digit di kiri kursor, lalu taruh kursor setelah digit yang sama
    const kiri = el.value.slice(0, el.selectionStart ?? el.value.length).replace(/\D/g, '').length
    const baru = ribuan(digit)
    el.value = baru
    let pos = 0, n = 0
    while (pos < baru.length && n < kiri) { if (/\d/.test(baru[pos])) n++; pos++ }
    el.setSelectionRange(pos, pos)
    onValueChange?.(digit)
  }

  return (
    <div className={clsx('fc-rp', size === 'md' && 'fc-rp-md', className)}>
      <span className="fc-rp-pre" aria-hidden>Rp</span>
      <input
        {...rest}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        {...(controlled ? { value: ribuan(value) } : { defaultValue: awal })}
        onChange={ketik}
      />
    </div>
  )
}
