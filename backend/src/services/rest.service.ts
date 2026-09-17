import { AssetUnit } from '../models/index.js'
import { logger } from '../config/logger.js'
import { currentOrganisation } from '../platform/orgScope.js'

/**
 * Puts animals back to work when their rest is over.
 *
 * Completing a session stands the animal down to `RESTING` (§7.3), and the counter will not offer
 * it while it rests (§11.1). Nothing used to end the rest, so every animal that worked once was
 * out of service for good — a location would run out of horses within a day of opening.
 *
 * Runs with the other session sweeps, once a minute, inside one organisation at a time.
 *
 * Units that were stood down before the end time was recorded on the unit carry it only in their
 * note ("Resting until <time> …"); those are read from the note once and released the same way.
 */
const NOTE_TIME = /Resting until (\d{4}-\d{2}-\d{2}T[\d:.]+Z)/

export async function sweepRestPeriods(now: Date = new Date()): Promise<number> {
  const released = await AssetUnit.updateMany(
    { status: 'RESTING', restingUntil: { $ne: null, $lte: now } },
    { $set: { status: 'AVAILABLE', restingUntil: null, note: '' } },
  )

  let fromNotes = 0
  const older = await AssetUnit.find({ status: 'RESTING', restingUntil: null, note: NOTE_TIME }, { note: 1 }).lean()
  for (const unit of older) {
    const until = new Date(NOTE_TIME.exec(unit.note ?? '')?.[1] ?? '')
    if (Number.isNaN(until.getTime())) continue
    if (until <= now) {
      await AssetUnit.updateOne({ _id: unit._id, status: 'RESTING' }, { $set: { status: 'AVAILABLE', note: '' } })
      fromNotes += 1
    } else {
      await AssetUnit.updateOne({ _id: unit._id }, { $set: { restingUntil: until } })
    }
  }

  const total = (released.modifiedCount ?? 0) + fromNotes
  if (total > 0) logger.info('Animals back from rest', { organisation: currentOrganisation(), count: total })
  return total
}
