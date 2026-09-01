import { create } from 'zustand'

export type ToastLevel = 'info' | 'success' | 'warning' | 'danger'
export interface Toast {
  id: string
  level: ToastLevel
  title: string
  message?: string
}

interface ToastState {
  toasts: Toast[]
  push: (t: Omit<Toast, 'id'>) => void
  dismiss: (id: string) => void
}

let n = 0
export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (t) => {
    n += 1
    const id = `toast_${n}`
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 4200)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}))

export function toast(level: ToastLevel, title: string, message?: string) {
  useToastStore.getState().push({ level, title, message })
}
