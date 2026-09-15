import { useCallback, useEffect, useState } from 'react'
import { KeyRound, ShieldCheck, UserPlus } from 'lucide-react'

import { platformApi, type PlatformAdminRow } from '../platformApi'
import { usePlatformSession } from '../platformClient'
import {
  DataTable,
  ErrorState,
  Labelled,
  PageHeader,
  Pill,
  PlatformButton,
  PlatformCard,
  Skeleton,
  StatusDot,
  Td,
  TextInput,
  Th,
  when,
} from '../components'
import { ConfirmDialog, useToast } from '../toast'

/**
 * Who can administer the platform.
 *
 * A platform administrator can reach every tenant on the installation, so this is the most
 * consequential list in the product. Two rules are enforced rather than documented:
 *
 *   - **There is no public registration, and there never will be.** An administrator can only
 *     be created by somebody already signed in here, or by whoever holds the server's
 *     environment when the very first one is made at boot. Self-service for an account with
 *     this reach is not a feature.
 *   - **The last active administrator cannot be suspended.** An installation nobody can sign
 *     in to is recoverable only from the server itself, and locking yourself out should not be
 *     two clicks away.
 */
export function PlatformAdminsPage() {
  const me = usePlatformSession((s) => s.admin)
  const { say } = useToast()

  const [rows, setRows] = useState<PlatformAdminRow[] | null>(null)
  const [error, setError] = useState('')

  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ fullName: '', email: '', password: '' })
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)

  const [confirming, setConfirming] = useState<PlatformAdminRow | null>(null)

  const load = useCallback(() => {
    setError('')
    platformApi
      .admins()
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : 'The administrator list could not be loaded.'))
  }, [])

  useEffect(load, [load])

  const create = async () => {
    setFormError('')
    setBusy(true)
    try {
      const created = await platformApi.createAdmin({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        password: form.password,
      })
      say(`${created.email} can now administer the platform.`)
      setForm({ fullName: '', email: '', password: '' })
      setAdding(false)
      load()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'The administrator could not be added.')
    } finally {
      setBusy(false)
    }
  }

  const toggle = async (row: PlatformAdminRow) => {
    setBusy(true)
    try {
      await platformApi.setAdminActive(row._id, !row.active)
      say(`${row.email} ${row.active ? 'suspended' : 'restored'}.`)
      setConfirming(null)
      load()
    } catch (e) {
      say(e instanceof Error ? e.message : 'That could not be changed.', 'bad')
      setConfirming(null)
    } finally {
      setBusy(false)
    }
  }

  if (error) return <ErrorState message={error} onRetry={load} testId="platform-admins-error" />

  const activeCount = rows?.filter((r) => r.active).length ?? 0

  return (
    <div data-testid="platform-admins">
      <PageHeader
        title="Administrators"
        blurb="Everybody who can sign in to the control plane. Each one can reach every tenant on this installation."
        actions={
          <PlatformButton onClick={() => setAdding((v) => !v)} testId="platform-add-admin">
            <UserPlus size={15} /> Add administrator
          </PlatformButton>
        }
      />

      <div
        className="rounded-xl border border-warning/30 bg-warning/[0.08] p-3 mb-5 flex items-start gap-2.5 text-[12px] text-warning-strong"
        data-testid="platform-admins-notice"
      >
        <KeyRound size={14} className="shrink-0 mt-0.5" />
        <p>
          There is no public sign-up for this. An administrator can only be added from here, by
          somebody already signed in, or created at boot from the server's own environment.
        </p>
      </div>

      {adding && (
        <PlatformCard className="mb-5" testId="platform-admin-form">
          <h2 className="text-[13px] font-bold uppercase tracking-wider text-muted mb-4">New administrator</h2>
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Labelled label="Full name">
              <TextInput
                value={form.fullName}
                onChange={(v) => setForm({ ...form, fullName: v })}
                placeholder="Alex Morgan"
                testId="admin-full-name"
              />
            </Labelled>
            <Labelled label="Email">
              <TextInput
                value={form.email}
                onChange={(v) => setForm({ ...form, email: v })}
                placeholder="alex@yourcompany.com"
                testId="admin-email"
              />
            </Labelled>
            <Labelled
              label="Password"
              hint="At least 12 characters. This account can reach every tenant, so it is held to more than a tenant login."
              problem={formError || undefined}
            >
              <TextInput
                value={form.password}
                onChange={(v) => setForm({ ...form, password: v })}
                type="password"
                testId="admin-password"
              />
            </Labelled>
          </div>
          <div className="flex justify-end gap-2">
            <PlatformButton variant="ghost" onClick={() => setAdding(false)} testId="admin-cancel">
              Cancel
            </PlatformButton>
            <PlatformButton
              onClick={create}
              busy={busy}
              disabled={!form.fullName.trim() || !form.email.trim() || form.password.length < 12}
              testId="admin-save"
            >
              Add administrator
            </PlatformButton>
          </div>
        </PlatformCard>
      )}

      {!rows ? (
        <Skeleton rows={3} testId="platform-admins-loading" />
      ) : (
        <DataTable
          testId="platform-admins-table"
          head={
            <>
              <Th>Administrator</Th>
              <Th>Status</Th>
              <Th>Last signed in</Th>
              <Th>Added</Th>
              <Th />
            </>
          }
        >
          {rows.map((r) => {
            const isMe = r._id === me?.id
            const lastActive = r.active && activeCount === 1
            return (
              <tr key={r._id} className="hover:bg-canvas" data-testid={`platform-admin-${r.email}`}>
                <Td>
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-lg bg-brand/10 text-brand flex items-center justify-center shrink-0">
                      <ShieldCheck size={15} />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold truncate">
                        {r.fullName}
                        {isMe && <span className="text-[11px] text-muted font-normal ms-1.5">(you)</span>}
                      </span>
                      <span className="block text-[11px] text-muted truncate">{r.email}</span>
                    </span>
                  </div>
                </Td>
                <Td>
                  <Pill tone={r.active ? 'live' : 'bad'}>
                    <StatusDot state={r.active ? 'good' : 'bad'} label={r.active ? 'active' : 'suspended'} />
                  </Pill>
                </Td>
                <Td className="text-muted text-[12px] whitespace-nowrap">
                  {r.lastLoginAt ? when(r.lastLoginAt) : 'never'}
                </Td>
                <Td className="text-muted text-[12px] whitespace-nowrap">{when(r.createdAt)}</Td>
                <Td className="text-end">
                  <button
                    onClick={() => setConfirming(r)}
                    disabled={isMe || lastActive}
                    data-testid={`admin-toggle-${r.email}`}
                    title={
                      isMe
                        ? 'You cannot suspend your own access'
                        : lastActive
                          ? 'The last active administrator cannot be suspended'
                          : undefined
                    }
                    className="text-[13px] font-medium text-muted hover:text-ink disabled:opacity-25 disabled:cursor-not-allowed"
                  >
                    {r.active ? 'Suspend' : 'Restore'}
                  </button>
                </Td>
              </tr>
            )
          })}
        </DataTable>
      )}

      <ConfirmDialog
        open={!!confirming}
        title={confirming?.active ? 'Suspend this administrator?' : 'Restore this administrator?'}
        confirmLabel={confirming?.active ? 'Suspend' : 'Restore'}
        tone={confirming?.active ? 'danger' : 'primary'}
        busy={busy}
        onCancel={() => setConfirming(null)}
        onConfirm={() => confirming && toggle(confirming)}
        body={
          confirming?.active ? (
            <>
              <p>
                <strong className="text-ink">{confirming.email}</strong> will no longer be able to sign in to the
                control plane. Nothing they have already done is undone, and the record of it stays in the audit log.
              </p>
              <p>They can be restored from this page at any time.</p>
            </>
          ) : (
            <p>
              <strong className="text-ink">{confirming?.email}</strong> will be able to sign in to the control plane
              again, with the same reach over every tenant as before.
            </p>
          )
        }
      />
    </div>
  )
}
