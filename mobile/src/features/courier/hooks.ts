import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { courierApi } from './api'
import type { CourierTransitionPayload } from './types'

export const courierKeys = {
  all: ['courier'] as const,
  board: () => [...courierKeys.all, 'board'] as const,
  run: (id: string) => [...courierKeys.all, 'run', id] as const,
}

/** A courier's board is a live thing — a desk can release bags while they are looking at it. */
const BOARD_POLL = 12_000
const RUN_POLL = 8_000

export const useCourierBoard = () =>
  useQuery({ queryKey: courierKeys.board(), queryFn: courierApi.board, refetchInterval: BOARD_POLL })

export const useRun = (id?: string) =>
  useQuery({
    queryKey: courierKeys.run(id ?? ''),
    queryFn: () => courierApi.detail(id!),
    enabled: !!id,
    refetchInterval: RUN_POLL,
  })

/** Both mutations touch the same two caches, so they share one invalidation. */
function useRunInvalidation() {
  const qc = useQueryClient()
  return (id: string) => {
    void qc.invalidateQueries({ queryKey: courierKeys.run(id) })
    void qc.invalidateQueries({ queryKey: courierKeys.board() })
  }
}

export function useCourierTransition() {
  const refresh = useRunInvalidation()
  return useMutation({
    mutationFn: ({ id, code, payload }: { id: string; code: string; payload?: CourierTransitionPayload }) =>
      courierApi.transition(id, code, payload),
    onSuccess: (_data, variables) => refresh(variables.id),
  })
}

export function useCollectStop() {
  const refresh = useRunInvalidation()
  return useMutation({
    mutationFn: ({ id, scannedBarcodes }: { id: string; scannedBarcodes: string[] }) =>
      courierApi.collectStop(id, scannedBarcodes),
    onSuccess: (_data, variables) => refresh(variables.id),
  })
}
