import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, GraduationCap, MessageSquareText, RotateCcw, Sparkles } from 'lucide-react';

import { PageHeader } from '@/components/PageHeader';
import { Badge, Card, SectionTitle } from '@/components/ui';
import { learningApi } from '@/api/learning.api';
import { useAssistantUi } from '@/features/assistant/assistantUi';
import { QUICK_ACTIONS } from '@/features/assistant/quickActions';
import { usePageContext, PAGE_KEYS } from '@/features/assistant/pageContext';
import { restartTour } from '@/features/onboarding/restartTour';
import { useAuthStore } from '@/store/auth';

/**
 * One place for "how do I do this".
 *
 * Deliberately thin: it does not restate the manual or the assistant, it points at them. The
 * two things that exist nowhere else are the tour restart and the tour's own status, and
 * those are what it is really for.
 */
export function TrainingPage() {
  const { t } = useTranslation(['onboarding', 'assistant', 'common']);
  const { openWith, setOpen } = useAssistantUi();
  const role = useAuthStore((s) => s.me?.role);

  usePageContext({
    pageKey: PAGE_KEYS.training,
    module: 'ONBOARDING',
    screenTitle: t('training.title'),
  });

  const capability = useQuery({
    queryKey: ['learning', 'capability'],
    queryFn: learningApi.capability,
    staleTime: 10 * 60_000,
    retry: false,
  });
  const onboarding = useQuery({
    queryKey: ['learning', 'onboarding'],
    queryFn: learningApi.onboarding,
    retry: false,
  });

  const status = onboarding.data?.status ?? 'PENDING';
  const enabled = capability.data?.enabled ?? false;

  return (
    <div className="space-y-6">
      <PageHeader title={t('training.title')} subtitle={t('training.subtitle')} />

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="flex flex-col">
          <div className="flex items-start gap-3 mb-3">
            <span className="w-10 h-10 rounded-xl bg-navy-50 dark:bg-dk-elevated text-brand flex items-center justify-center shrink-0">
              <GraduationCap size={20} />
            </span>
            <div className="min-w-0">
              <SectionTitle className="mb-0.5">{t('training.tour.title')}</SectionTitle>
              <p className="text-sm text-muted">{t('training.tour.body')}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <Badge
              tone={status === 'COMPLETED' ? 'success' : status === 'SKIPPED' ? 'warning' : 'info'}
              testId="onboarding-status"
            >
              {t(`status.${status}`)}
            </Badge>
            {role && (
              <Badge tone="neutral">{t(`tour.${onboarding.data?.tourKey ?? 'agent'}`)}</Badge>
            )}
          </div>

          <button
            type="button"
            onClick={restartTour}
            data-testid="training-restart-tour"
            className="lf-btn-primary mt-auto self-start"
          >
            <RotateCcw size={16} /> {t('training.tour.restart')}
          </button>
        </Card>

        <Card className="flex flex-col">
          <div className="flex items-start gap-3 mb-3">
            <span className="w-10 h-10 rounded-xl bg-navy-50 dark:bg-dk-elevated text-brand flex items-center justify-center shrink-0">
              <Sparkles size={20} />
            </span>
            <div className="min-w-0">
              <SectionTitle className="mb-0.5">{t('title', { ns: 'assistant' })}</SectionTitle>
              <p className="text-sm text-muted">
                {enabled ? t('training.assistant.body') : t('training.assistant.disabled')}
              </p>
            </div>
          </div>

          {enabled && (
            <>
              <div className="flex flex-wrap gap-2 mb-4">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => openWith(t(action.questionKey, { ns: 'assistant' }))}
                    data-testid={`training-quick-${action.id}`}
                    className="lf-chip bg-navy-50 dark:bg-dk-elevated text-brand dark:text-accent hover:opacity-80"
                  >
                    {t(action.labelKey, { ns: 'assistant' })}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setOpen(true)}
                data-testid="training-open-assistant"
                className="lf-btn-secondary mt-auto self-start"
              >
                <MessageSquareText size={16} /> {t('training.assistant.open')}
              </button>
            </>
          )}
        </Card>
      </div>

      <Card>
        <SectionTitle>{t('training.resources.title')}</SectionTitle>
        <p className="text-sm text-muted mb-4">{t('training.resources.body')}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Link
            to="/help/manual"
            data-testid="training-manual-link"
            className="lf-card lf-card-hover p-3.5 flex items-center gap-3"
          >
            <BookOpen size={18} className="text-brand shrink-0" />
            <span className="min-w-0">
              <span className="block font-semibold text-sm text-navy dark:text-dk-texthi">
                {t('training.resources.manual')}
              </span>
              <span className="block text-xs text-muted">{t('training.resources.manualHint')}</span>
            </span>
          </Link>
          <Link
            to="/versions"
            data-testid="training-versions-link"
            className="lf-card lf-card-hover p-3.5 flex items-center gap-3"
          >
            <Sparkles size={18} className="text-brand shrink-0" />
            <span className="min-w-0">
              <span className="block font-semibold text-sm text-navy dark:text-dk-texthi">
                {t('training.resources.releases')}
              </span>
              <span className="block text-xs text-muted">
                {t('training.resources.releasesHint')}
              </span>
            </span>
          </Link>
        </div>
      </Card>
    </div>
  );
}
