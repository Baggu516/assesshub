import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, EmptyState, PageHeader, Skeleton } from '@/components/ui';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { useMyAssignmentsQuery, type ExamKind } from '@/hooks/api/useAssessments';

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function MyAssessmentsPage({ kind = 'assessment' }: { kind?: ExamKind }) {
  const online = kind === 'online_exam';
  const mine = online ? '/my-online-exams' : '/my-assessments';
  const { yearId, sortedYears } = useAcademicYear();
  const queryYear = yearId || undefined;
  const { data, isLoading } = useMyAssignmentsQuery(queryYear, kind);
  const assignments = data?.assignments ?? [];
  const [now, setNow] = useState(() => Date.now());

  const nextStart = useMemo(() => {
    let soonest: number | null = null;
    for (const a of assignments) {
      if (a.status !== 'pending' || a.startedAt || !a.startAt) continue;
      const starts = new Date(a.startAt).getTime();
      if (Number.isNaN(starts) || starts <= now) continue;
      if (soonest == null || starts < soonest) soonest = starts;
    }
    return soonest;
  }, [assignments, now]);

  useEffect(() => {
    if (nextStart == null) return undefined;
    const id = window.setTimeout(() => setNow(Date.now()), Math.max(250, nextStart - Date.now()));
    return () => window.clearTimeout(id);
  }, [nextStart]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Student"
        title={online ? 'Online exams' : 'My assessments'}
        description={
          online
            ? 'CBT exams open in fullscreen. Leaving fullscreen three times submits the exam. Results appear after your teacher announces them.'
            : 'Assessments you can attempt online. Results appear after your teacher announces them.'
        }
      />

      {isLoading || (sortedYears.length > 0 && !yearId) ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      ) : assignments.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            title={online ? 'No online exams yet' : 'No assessments yet'}
            description={
              yearId === 'all'
                ? online
                  ? 'When your teacher assigns an online exam, it will show up here.'
                  : 'When your teacher assigns an assessment, it will show up here.'
                : online
                  ? 'No online exams for this academic year. Change the year in the sidebar.'
                  : 'No assessments for this academic year. Change the year in the sidebar.'
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {assignments.map((a) => {
            const pending = a.status === 'pending';
            const dueLabel = formatDateTime(a.dueDate || a.endAt);
            const startLabel = formatDateTime(a.startAt);
            const submittedLabel = formatDateTime(a.submittedAt);
            const qCount = a.questionCount ?? 0;
            const marks = a.totalMarks ?? a.maxScore ?? 0;
            const duration = a.durationMinutes ?? 60;

            return (
              <Card key={a.id} className="flex flex-col p-5">
                <div className="mb-2 flex flex-wrap gap-2">
                  <Badge tone={pending ? 'warning' : a.resultsVisible ? 'success' : 'warning'}>
                    {pending
                      ? 'Pending'
                      : a.resultsVisible
                        ? 'Results out'
                        : 'Submitted · results held'}
                  </Badge>
                  {yearId === 'all' && a.academicYearLabel ? (
                    <Badge tone="neutral">{a.academicYearLabel}</Badge>
                  ) : null}
                  {startLabel ? <Badge tone="neutral">Starts {startLabel}</Badge> : null}
                  {dueLabel ? <Badge tone="warning">Due {dueLabel}</Badge> : null}
                </div>

                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {a.assessmentTitle || 'Assessment'}
                </h3>
                {a.assessmentDescription ? (
                  <p className="mt-1 line-clamp-2 text-sm text-slate-500">{a.assessmentDescription}</p>
                ) : null}

                <p className="mt-3 text-xs text-slate-500">
                  {qCount} question{qCount !== 1 ? 's' : ''} · {marks} mark{marks !== 1 ? 's' : ''} ·{' '}
                  {duration} min
                  {!pending && a.resultsVisible && a.score != null
                    ? ` · Score ${a.score}/${a.maxScore}`
                    : ''}
                  {submittedLabel ? ` · Submitted ${submittedLabel}` : ''}
                </p>

                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  {pending && !a.startedAt && a.startAt && new Date(a.startAt).getTime() > now ? (
                    <Button size="sm" disabled title={startLabel ? `Starts ${startLabel}` : undefined}>
                      Not yet started
                    </Button>
                  ) : (
                    <Link to={`${mine}/${a.id}`}>
                      <Button size="sm" variant={pending ? 'primary' : 'secondary'}>
                        {pending ? 'Start' : a.resultsVisible ? 'View results' : 'View submission'}
                      </Button>
                    </Link>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
