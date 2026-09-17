import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Info, Users } from 'lucide-react';
import { clsx } from 'clsx';

import { PageHeader } from '@/components/PageHeader';
import { Badge, Card, SectionTitle, Spinner } from '@/components/ui';
import { PERMISSION_ROLES, type Permission } from '@/permissions/permissions';
import { useManagerStaff } from '@/hooks';
import { SCOPE_LEVEL } from '@/config/roleRules';
import type { Role } from '@/api/types';

/**
 * Who can do what.
 *
 * ## Why this page only reads
 *
 * A role is the platform's, not a company's. It is a fixed list because permissions have to
 * be: every screen, every route guard and every endpoint is written against these names, so a
 * company inventing an eighth role would be inventing something nothing in the product knows
 * how to honour.
 *
 * There used to be a builder here — a page for composing roles out of permissions — and the
 * client rejected it along with the rest of the configure-it-yourself model. Removing it left
 * the sidebar pointing at nothing, which is what an administrator found.
 *
 * So this is the reference it should always have been: the roles, what each one may do, and
 * how many people here hold it. What a company *does* control is who it gives each role to,
 * and that is the Team page.
 *
 * ## The job title question
 *
 * WIQAR's CEO and IT Manager both hold `TENANT_ADMIN`, because both need full configuration
 * access. That is the authorisation fact this page describes. Their job *titles* are a
 * separate thing, recorded per person and shown on the Team page.
 */

const ROLE_ORDER: Role[] = [
  'TENANT_ADMIN',
  'PROJECT_MANAGER',
  'MANAGER',
  'SUPERVISOR',
  'ACCOUNTANT',
  'HR',
  'AGENT',
  'CHIEF_CAPTAIN',
  'DELIVERY_AGENT',
];

const SCOPE_NOTE: Record<string, string> = {
  tenant: 'Sees the whole company',
  activity: 'Sees one activity, across every counter',
  kiosk: 'Sees one counter',
};

export function AdminRoles() {
  const { t } = useTranslation(['admin', 'common']);
  const { data: staff = [], isLoading } = useManagerStaff();

  /** How many people here hold each role — the part that is actually this company's. */
  const held = useMemo(() => {
    const counts = new Map<Role, number>();
    for (const person of staff) {
      if (person.active === false) continue;
      counts.set(person.role, (counts.get(person.role) ?? 0) + 1);
    }
    return counts;
  }, [staff]);

  if (isLoading) {
    return (
      <div data-testid="admin-roles">
        <PageHeader
          title={t('roles.title', { defaultValue: 'Roles & permissions' })}
          subtitle={t('common:state.loading')}
        />
        <Spinner />
      </div>
    );
  }

  return (
    <div data-testid="admin-roles">
      <PageHeader
        title={t('roles.title', { defaultValue: 'Roles & permissions' })}
        subtitle={t('roles.subtitle', {
          defaultValue: 'What each role may do, and how many people here hold it',
        })}
      />

      <Card className="mb-4 flex items-start gap-3 p-4" data-testid="roles-explainer">
        <Info size={16} className="mt-0.5 shrink-0 text-muted" />
        <p className="text-[12.5px] leading-relaxed text-muted">
          {t('roles.readOnly', {
            defaultValue:
              'Roles belong to the platform: every screen and every endpoint is written against these names, so they are the same at every company. What you choose is who holds each one — that is on the Team page.',
          })}
        </p>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {ROLE_ORDER.map((role) => (
          <Card key={role} className="p-4" data-testid={`role-${role}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[13.5px] font-semibold text-navy dark:text-dk-texthi">
                  {t(`common:role.${role}`, { defaultValue: role })}
                </div>
                <div className="text-[11.5px] text-muted">
                  {SCOPE_NOTE[SCOPE_LEVEL[role]] ?? ''}
                </div>
              </div>
              <Badge tone={held.get(role) ? 'info' : 'neutral'}>
                <Users size={11} /> {held.get(role) ?? 0}
              </Badge>
            </div>

            <ul className="mt-3 space-y-1">
              {(Object.keys(PERMISSION_ROLES) as Permission[])
                .filter((permission) => PERMISSION_ROLES[permission].includes(role))
                .map((permission) => (
                  <li
                    key={permission}
                    className="flex items-start gap-1.5 text-[11.5px] text-muted"
                  >
                    <Check size={11} className="mt-[3px] shrink-0 text-success" />
                    <span>{t(`admin:permission.${permission}`, { defaultValue: permission })}</span>
                  </li>
                ))}
            </ul>
          </Card>
        ))}
      </div>

      <SectionTitle className="mt-6">
        {t('roles.matrix', { defaultValue: 'Everything, side by side' })}
      </SectionTitle>
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[760px] text-[12px]" data-testid="roles-matrix">
          <thead>
            <tr className="border-b border-line dark:border-dk-line">
              <th className="p-2.5 text-start font-semibold">
                {t('roles.permission', { defaultValue: 'Permission' })}
              </th>
              {ROLE_ORDER.map((role) => (
                <th key={role} className="p-2.5 text-center font-semibold">
                  <span className="block max-w-[74px] text-[10.5px] leading-tight">
                    {t(`common:role.${role}`, { defaultValue: role })}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(Object.keys(PERMISSION_ROLES) as Permission[]).map((permission) => (
              <tr
                key={permission}
                className="border-b border-line last:border-0 dark:border-dk-line"
              >
                <td className="p-2.5 text-muted">
                  {t(`admin:permission.${permission}`, { defaultValue: permission })}
                </td>
                {ROLE_ORDER.map((role) => {
                  const allowed = PERMISSION_ROLES[permission].includes(role);
                  return (
                    <td key={role} className="p-2.5 text-center">
                      <span
                        className={clsx(
                          'inline-grid h-4 w-4 place-items-center rounded',
                          allowed ? 'bg-success/15 text-success' : 'text-muted/30'
                        )}
                        aria-label={allowed ? 'allowed' : 'not allowed'}
                      >
                        {allowed ? <Check size={11} /> : '·'}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
