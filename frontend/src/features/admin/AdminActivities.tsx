import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Check, Info, Users } from 'lucide-react';
import { clsx } from 'clsx';

import { PageHeader } from '@/components/PageHeader';
import { Badge, Button, Card, SectionTitle, Spinner } from '@/components/ui';
import { adminApi, type CatalogueActivity } from '@/api/admin.api';
import { useAuthStore } from '@/store/auth';
import { isTenantAdminRole } from '@/permissions/permissions';
import type { EngineKind } from '@/api/types';

/**
 * The activities this organisation runs.
 *
 * ## What this page is, and firmly is not
 *
 * It is a catalogue with a tick against each entry. Every activity on it was **written** — a
 * workflow, its validators and its operations, in code, exactly as Shop & Drop and Lagoon were
 * written. What an administrator does here is decide which of them their company runs.
 *
 * It is **not** a builder. There is no way from this page to define an activity, edit a
 * workflow, add a condition, or compose a form, and there should never be. Adding activity
 * number twelve means writing it.
 *
 * ## Why it matters that unadopted activities are still shown
 *
 * The point of the screen is the choice, so hiding what has not been taken up would hide it.
 * An activity nobody at this company runs is greyed, described, and one click from being
 * adopted.
 *
 * ## Who may change it
 *
 * Reading is open to the back office, because the employee form and the estate pages both need
 * to know what this company runs. Changing it is the administrator's, which is what the server
 * enforces — this page hides the control for everybody else rather than offering a button that
 * would be refused.
 */
export function AdminActivities() {
  const { t } = useTranslation(['admin', 'common']);
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.me?.role);
  const mayAdopt = isTenantAdminRole(role);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'activities'],
    queryFn: () => adminApi.activities(),
  });

  /* Local until saved, so ticking several before committing does not fire a request each. */
  const [chosen, setChosen] = useState<EngineKind[] | null>(null);
  useEffect(() => {
    if (data && chosen === null) setChosen(data.adopted);
  }, [data, chosen]);

  const adopt = useMutation({
    mutationFn: (activities: EngineKind[]) => adminApi.adoptActivities(activities),
    onSuccess: async () => {
      /*
       * Everything narrows by what this company runs — the sidebar, the counter, the employee
       * form, the estate, the accounts. All of it is stale the moment this changes.
       */
      await qc.invalidateQueries();
    },
  });

  if (isLoading || !data || chosen === null) {
    return (
      <div data-testid="admin-activities">
        <PageHeader
          title={t('activities.title', { defaultValue: 'Activities' })}
          subtitle={t('common:state.loading')}
        />
        <Spinner />
      </div>
    );
  }

  const adopted = data.adopted;
  const dirty = chosen.length !== adopted.length || chosen.some((k) => !adopted.includes(k));

  const toggle = (key: EngineKind) =>
    setChosen((c) =>
      (c ?? []).includes(key) ? (c ?? []).filter((k) => k !== key) : [...(c ?? []), key]
    );

  return (
    <div data-testid="admin-activities">
      <PageHeader
        title={t('activities.title', { defaultValue: 'Activities' })}
        subtitle={t('activities.subtitle', {
          defaultValue: 'Everything the platform can run, and what this company has taken up',
        })}
        actions={
          mayAdopt && dirty ? (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => setChosen(adopted)}
                data-testid="activities-cancel"
              >
                {t('common:action.cancel', { defaultValue: 'Cancel' })}
              </Button>
              <Button
                onClick={() => adopt.mutate(chosen)}
                loading={adopt.isPending}
                data-testid="activities-save"
              >
                {t('activities.save', { defaultValue: 'Save changes' })}
              </Button>
            </div>
          ) : (
            <Badge tone="neutral" data-testid="activities-count">
              {adopted.length} of {data.catalogue.length}
            </Badge>
          )
        }
      />

      {!mayAdopt && (
        <Card className="mb-4 flex items-start gap-3 p-4" data-testid="activities-readonly">
          <Info size={16} className="mt-0.5 shrink-0 text-muted" />
          <p className="text-[12.5px] text-muted">
            {t('activities.readOnly', {
              defaultValue:
                'This is what your company runs. Only an administrator can take up a new activity or drop one.',
            })}
          </p>
        </Card>
      )}

      <SectionTitle>{t('activities.running', { defaultValue: 'Running here' })}</SectionTitle>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {data.catalogue.map((activity) => (
          <ActivityCard
            key={activity.key}
            activity={activity}
            on={chosen.includes(activity.key)}
            changed={chosen.includes(activity.key) !== adopted.includes(activity.key)}
            disabled={!mayAdopt || adopt.isPending}
            onToggle={() => toggle(activity.key)}
          />
        ))}
      </div>

      {adopt.isError && (
        <p className="mt-4 text-[12.5px] text-danger" data-testid="activities-error">
          {adopt.error instanceof Error ? adopt.error.message : 'Could not save that.'}
        </p>
      )}
    </div>
  );
}

function ActivityCard({
  activity,
  on,
  changed,
  disabled,
  onToggle,
}: {
  activity: CatalogueActivity;
  on: boolean;
  changed: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      aria-pressed={on}
      data-testid={`activity-${activity.key}`}
      className={clsx(
        'lf-card p-4 text-start transition-all disabled:cursor-default',
        on ? 'border-brand ring-2 ring-brand/20' : 'opacity-70 hover:opacity-100',
        changed && 'ring-2 ring-warning/50'
      )}
    >
      <div className="flex items-start gap-2.5">
        <div
          className={clsx(
            'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors',
            on ? 'border-brand bg-brand text-white' : 'border-line'
          )}
        >
          {on && <Check size={13} />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-semibold text-navy dark:text-dk-texthi">
            {activity.label.en}
          </div>
          <div className="text-[11.5px] text-muted" dir="rtl">
            {activity.label.ar}
          </div>

          <p className="mt-2 text-[12px] leading-relaxed text-muted">{activity.description}</p>

          {activity.actors.length > 0 && (
            <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-muted">
              <Users size={12} className="shrink-0" />
              <span className="truncate">{activity.actors.join(' · ')}</span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
