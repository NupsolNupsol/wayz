import { useState } from 'react'
import { FlatList, View } from 'react-native'

import { apiMessage } from '@/api/client'
import { AppHeader } from '@/components/AppHeader'
import { Icon } from '@/components/Icon'
import {
  Button,
  EmptyState,
  Field,
  ListGroup,
  ListRow,
  Loading,
  Muted,
  OptionRow,
  Ref,
  Screen,
  Sheet,
  StatusPill,
  TextArea,
  toast,
} from '@/components/ui'
import { enginesFor } from '@/config/engines'
import { useCreateIncident, useIncidentCatalogue, useIncidents } from '@/hooks/queries'
import { formatDateTime } from '@/lib/format'
import { useSessionStore } from '@/store/session.store'
import { COLORS } from '@/theme/tokens'
import type { EngineKind } from '@/types'

export default function Incidents() {
  const me = useSessionStore((s) => s.me)
  const { data = [], isLoading, isFetching, refetch } = useIncidents()
  const catalogue = useIncidentCatalogue()
  const create = useCreateIncident()

  const engines = enginesFor(me?.engineKinds ?? [])
  const [open, setOpen] = useState(false)
  const [engine, setEngine] = useState<EngineKind | null>(engines[0] ?? null)
  const [type, setType] = useState<string | null>(null)
  const [description, setDescription] = useState('')

  const types = engine ? (catalogue.data?.byEngine?.[engine] ?? []) : []
  const label = (code: string) => catalogue.data?.labels?.[code] ?? code.replaceAll('_', ' ')

  const submit = () => {
    if (!type) return
    create.mutate(
      { type, description: description.trim(), engineKind: engine ?? undefined },
      {
        onSuccess: () => {
          toast('warn', 'Incident reported', 'Your manager sees it straight away.')
          setOpen(false)
          setType(null)
          setDescription('')
        },
        onError: (e) => toast('danger', 'Could not report it', apiMessage(e)),
      },
    )
  }

  return (
    <Screen padded={false} testID="incidents">
      <View className="px-4 pb-3 pt-2">
        <AppHeader
          back
          title="Incidents"
          subtitle="Anything that went wrong at this counter"
          actions={<Button label="Report" size="sm" onPress={() => setOpen(true)} testID="incidents-report" />}
        />
      </View>

      {isLoading && !data.length ? (
        <Loading />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item._id}
          onRefresh={() => void refetch()}
          refreshing={isFetching}
          contentContainerClassName="px-4 pb-6"
          ListEmptyComponent={
            <EmptyState
              icon={<Icon name="AlertTriangle" size={24} color={COLORS.faint} />}
              title="No incidents"
              message="Everything is running smoothly."
              testID="incidents-empty"
            />
          }
          renderItem={({ item, index }) => (
            <ListGroup className={index === 0 ? '' : 'mt-2'}>
              <ListRow
                chevron={false}
                testID={`incident-${item._id}`}
                title={<Ref>{item.ref}</Ref>}
                subtitle={item.description}
                trailing={
                  <>
                    <StatusPill status={item.status} size="sm" />
                    <Muted className="text-[11px]">{formatDateTime(item.createdAt)}</Muted>
                  </>
                }
              />
            </ListGroup>
          )}
        />
      )}

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Report an incident"
        subtitle="Write what you saw — your manager reads this."
        testID="incident-sheet"
        footer={
          <Button
            label="Report it"
            variant="danger"
            size="lg"
            full
            disabled={!type || description.trim().length < 3}
            loading={create.isPending}
            onPress={submit}
            testID="incident-submit"
          />
        }
      >
        {engines.length > 1 ? (
          <Field label="Which activity">
            <View className="gap-2">
              {engines.map((kind) => (
                <OptionRow
                  key={kind}
                  selected={engine === kind}
                  onPress={() => {
                    setEngine(kind)
                    setType(null)
                  }}
                  title={kind.replaceAll('_', ' ')}
                  testID={`incident-engine-${kind}`}
                />
              ))}
            </View>
          </Field>
        ) : null}

        <Field label="What happened" required>
          <View className="gap-2">
            {types.length === 0 ? (
              <Muted>No categories for this activity.</Muted>
            ) : (
              types.map((code) => (
                <OptionRow
                  key={code}
                  selected={type === code}
                  onPress={() => setType(code)}
                  title={label(code)}
                  testID={`incident-type-${code}`}
                />
              ))
            )}
          </View>
        </Field>

        <Field label="Describe it plainly" required>
          <TextArea
            value={description}
            onChangeText={setDescription}
            placeholder="e.g. Compartment CMP-07 will not close after the bag was taken out"
            testID="incident-description"
          />
        </Field>
      </Sheet>
    </Screen>
  )
}
