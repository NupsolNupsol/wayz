import type { BookingDoc } from '../models/index.js'
import { computeOvertime } from '../domain/overtime.js'

export function bookingDTO(b: BookingDoc) {
  const obj = typeof (b as unknown as { toObject?: () => unknown }).toObject === 'function'
    ? (b as unknown as { toObject: () => Record<string, unknown> }).toObject()
    : (b as unknown as Record<string, unknown>)

  const overtime = computeOvertime(b.session)

  return {
    ...obj,
    id: b._id,
    session: {
      ...(obj as { session: object }).session,
      remainingMs: overtime.remainingMs,
      isOvertime: overtime.isOvertime,
      overtime,
    },
  }
}

export function bookingListDTO(list: BookingDoc[]) {
  return list.map(bookingDTO)
}
