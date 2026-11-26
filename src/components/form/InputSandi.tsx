'use client'

// Kolom kata sandi dengan tombol mata untuk melihat / menyembunyikan isinya.
import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import clsx from 'clsx'

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & { wrapClassName?: string }

export default function InputSandi({ wrapClassName, className, ...rest }: Props) {
  const [lihat, setLihat] = useState(false)
  return (
    <div className={clsx('fc-sandi', wrapClassName)}>
      <input {...rest} type={lihat ? 'text' : 'password'} className={clsx(className, 'pr-11')} />
      <button
        type="button"
        onClick={() => setLihat((v) => !v)}
        className="fc-sandi-mata"
        aria-label={lihat ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
        aria-pressed={lihat}
        title={lihat ? 'Sembunyikan' : 'Lihat'}
      >
        {lihat ? <EyeOff size={18} strokeWidth={2.2} /> : <Eye size={18} strokeWidth={2.2} />}
      </button>
    </div>
  )
}
