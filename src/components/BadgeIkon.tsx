// Ikon badge + warna tingkat (perunggu/perak/emas). Pengganti emoji badge.
import {
  PenLine, Flame, PiggyBank, Wallet, Coins, CalendarCheck, Star, ClipboardList,
  Pizza, Users, HandCoins, BadgeCheck, ScanLine, type LucideIcon,
} from 'lucide-react'
import type { IkonBadge } from '@/lib/gamify'

const IKON: Record<IkonBadge, LucideIcon> = {
  pencatat: PenLine, rajin: Flame, hemat: PiggyBank, anggaran: Wallet, penabung: Coins,
  rutin: CalendarCheck, impian: Star, perencana: ClipboardList, patungan: Pizza,
  lingkaran: Users, bebas: BadgeCheck, penagih: HandCoins, pemindai: ScanLine,
}

export default function BadgeIkon({ ikon, tingkat, size = 56, label }: { ikon: IkonBadge; tingkat: number; size?: number; label?: string }) {
  const Ikon = IKON[ikon]
  return (
    <span
      className={`fc-medal fc-medal-${tingkat}`}
      style={{ width: size, height: size }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <Ikon size={Math.round(size * 0.46)} strokeWidth={2.4} />
    </span>
  )
}
