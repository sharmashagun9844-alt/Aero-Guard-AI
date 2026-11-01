import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const fmt = (n: number, digits = 0) =>
  n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })
