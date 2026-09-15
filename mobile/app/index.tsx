import { useQuery } from '@tanstack/react-query'
import { Redirect } from 'expo-router'
import { View } from 'react-native'

import { authApi } from '@/api/endpoints'
import { Loading } from '@/design'
import { homeFor } from '@/lib/workspace'
import { useSessionStore } from '@/store/session.store'

/**
 * The only job of the entry route: work out who is holding the device, and send them to their
 * workspace. The role decides — a courier never lands on a counter, an agent never lands on a run
 * board — so the two apps can be built without either knowing about the other.
 */
export default function Index() {
  const ready = useSessionStore((s) => s.ready)
  const token = useSessionStore((s) => s.token)
  const me = useSessionStore((s) => s.me)
  const setMe = useSessionStore((s) => s.setMe)

  const { data, isLoading } = useQuery({ queryKey: ['me'], queryFn: authApi.me, enabled: !!token && !me })
  const person = me ?? data
  if (data && !me) setMe(data)

  if (!ready || (token && !person && isLoading)) {
    return (
      <View className="flex-1 bg-canvas" testID="boot">
        <Loading />
      </View>
    )
  }

  if (!token) return <Redirect href="/sign-in" />
  if (!person) return <Redirect href="/sign-in" />

  return <Redirect href={homeFor(person.role) as never} />
}
