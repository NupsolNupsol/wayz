import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { authApi } from '@/api/endpoints'
import { workspaceFor } from '@/lib/workspace'
import { useSessionStore } from '@/store/session.store'
import type { Me } from '@/types'

/**
 * Raised when the credentials were right but the person has no workspace on a handheld.
 *
 * It is thrown before the token is stored, so a manager signing in is refused outright rather than
 * left holding a session for an app that has nothing to show them.
 */
export class NoWorkspaceError extends Error {
  constructor(readonly person: Me) {
    super(
      `${person.fullName} signs in as ${person.role.replaceAll('_', ' ').toLowerCase()}. That work is done on the web workspace, not on a handheld.`,
    )
    this.name = 'NoWorkspaceError'
  }
}

/**
 * Resolves who is signed in, once, for whoever asks.
 *
 * The token lives in secure storage and survives a restart; the person behind it does not, so it
 * is fetched on the first render that needs it and mirrored into the store for the screens that
 * only want a name. Every layout calls this, and react-query makes sure that is still one request.
 */
export function useSession(): { me: Me | null; ready: boolean; loading: boolean; failed: boolean } {
  const ready = useSessionStore((s) => s.ready)
  const token = useSessionStore((s) => s.token)
  const me = useSessionStore((s) => s.me)
  const setMe = useSessionStore((s) => s.setMe)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['me'],
    queryFn: authApi.me,
    enabled: !!token && !me,
    retry: 1,
  })

  useEffect(() => {
    if (data) setMe(data)
  }, [data, setMe])

  return {
    me: me ?? data ?? null,
    ready,
    loading: !!token && !me && isLoading,
    failed: isError,
  }
}

export function useSignIn() {
  const signIn = useSessionStore((s) => s.signIn)
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const result = await authApi.login(email.trim(), password)
      // Checked here rather than in the screen: nothing is persisted for a role the app cannot serve.
      if (workspaceFor(result.user.role) === 'unsupported') throw new NoWorkspaceError(result.user)
      return result
    },
    onSuccess: async (result) => {
      await signIn(result.token, result.user)
      // A previous session's cache would otherwise show through for a frame.
      qc.clear()
      qc.setQueryData(['me'], result.user)
    },
  })
}

export function useSignOut() {
  const signOut = useSessionStore((s) => s.signOut)
  const qc = useQueryClient()

  return async () => {
    await signOut()
    qc.clear()
  }
}
