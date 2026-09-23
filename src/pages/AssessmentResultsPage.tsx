import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Skeleton,
} from '@/components/ui';
import {
  useAssessmentResultsQuery,
  useAssessmentMutations,
  type AssessmentAssignment,
  type ExamKind,
} from '@/hooks/api/useAssessments';
import { useAcademicYearsQuery } from '@/hooks/api/useAcademicYears';

function formatDuration(seconds: number | null | undefined) {
  if (seconds == null || Number.isNaN(seconds)) return '—';
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m <= 0) return `${r}s`;
  return `${m}m ${String(r).padStart(2, '0')}s`;
}

function formatMarks(n: number) {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2).replace(/\.?0+$/, '');
}

function scoreTone(percentage: number) {
  if (percentage >= 75) return 'text-emerald-600 dark:text-emerald-400';
  if (percentage >= 40) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function sortByRank(results: AssessmentAssignment[]) {
  return [...results].sort((a, b) => {
    const pctDiff = Number(b.percentage || 0) - Number(a.percentage || 0);
    if (pctDiff !== 0) return pctDiff;
    const marksDiff = Number(b.scoredMarks ?? b.score ?? 0) - Number(a.scoredMarks ?? a.score ?? 0);
    if (marksDiff !== 0) return marksDiff;
    return Number(a.timeTakenSeconds || 0) - Number(b.timeTakenSeconds || 0);
  });
}

function withRanks(results: AssessmentAssignment[]) {
  const sorted = sortByRank(results.filter((r) => r.status === 'submitted'));
  const pending = results.filter((r) => r.status !== 'submitted');
  let lastPercentage: number | null = null;
  let lastRank = 0;

  const ranked = sorted.map((row, index) => {
    const percentage = Number(row.percentage || 0);
    if (lastPercentage === null || percentage !== lastPercentage) {
      lastRank = index + 1;
      lastPercentage = percentage;
    }
    return { ...row, rank: lastRank as number | null };
  });

  return [
    ...ranked,
    ...pending.map((row) => ({ ...row, rank: null as number | null })),
  ];
}

function downloadCsv(results: AssessmentAssignment[], title: string) {
  const headers = [
    'Rank',
    'Name',
    'Email',
    'Status',
    'Score',
    'Max',
    'Percentage',
    'Right',
    'Partial',
    'Wrong',
    'Skipped',
    'Time (s)',
    'Auto-submitted',
  ];
  const ranked = withRanks(results);
  const rows = ranked.map((r) => [
    r.rank ?? '',
    r.studentName || r.studentLabel || '',
    r.studentEmail || '',
    r.status,
    r.scoredMarks ?? r.score ?? 0,
    r.totalMarks ?? r.maxScore ?? 0,
    Math.round(r.percentage || 0),
    r.correctCount ?? 0,
    r.partialCount ?? 0,
    r.wrongCount ?? 0,
    r.unansweredCount ?? 0,
    r.timeTakenSeconds ?? '',
    r.autoSubmitted ? 'yes' : 'no',
  ]);
  const escape = (v: string | number) => {
    const s = String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const csv = [headers, ...rows].map((row) => row.map(escape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const slug = (title || 'assessment')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  a.href = url;
  a.download = `${slug || 'assessment'}-results-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function AssessmentResultsPage({ kind = 'assessment' }: { kind?: ExamKind }) {
  const base = kind === 'online_exam' ? '/online-exams' : '/assessments';
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const { data: years = [] } = useAcademicYearsQuery();
  const sortedYears = useMemo(
    () => [...years].sort((a, b) => b.label.localeCompare(a.label)),
    [years]
  );
  const currentYear = useMemo(
    () => sortedYears.find((y) => y.isCurrent) || sortedYears[0] || null,
    [sortedYears]
  );
  const [yearId, setYearId] = useState('');
  const effectiveYear = yearId || currentYear?.id || '';

  const { data, isLoading, isError, refetch } = useAssessmentResultsQuery(
    assessmentId,
    effectiveYear || undefined
  );
  const { reattempt, hideResult, deleteResult, releaseResults } = useAssessmentMutations();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<'reattempt' | 'hide' | 'delete' | null>(null);

  const ranked = useMemo(() => withRanks(data?.results || []), [data?.results]);
  const assessment = data?.assessment;
  const summary = data?.summary;

  const released = Boolean(assessment?.resultsReleased);
  const pendingReleaseCount = Number(summary?.pendingReleaseCount || 0);
  const canAnnounce = pendingReleaseCount > 0;

  const handleAnnounce = async () => {
    if (!assessmentId || !canAnnounce) return;
    const confirmMessage = released
      ? `Announce results for ${pendingReleaseCount} new submission${pendingReleaseCount === 1 ? '' : 's'}? Those students will be able to view scores and get an email (scores are not in the email).`
      : 'Announce results to students? They will be able to view scores on the site, and each submitted student will get an email (scores are not in the email).';
    if (!window.confirm(confirmMessage)) return;
    try {
      const res = await releaseResults.mutateAsync(assessmentId);
      const n = res.notify || { emailed: 0, failed: 0, skipped: 0 };
      toast.success(
        `${res.message} Emails sent: ${n.emailed}${n.failed ? `, failed: ${n.failed}` : ''}${n.skipped ? `, skipped: ${n.skipped}` : ''}.`
      );
      refetch();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Could not announce results');
    }
  };

  const handleReattempt = async (row: AssessmentAssignment) => {
    const name = row.studentName || row.studentLabel || 'this student';
    if (
      !window.confirm(
        `Let ${name} write this assessment again? Their current score is cleared until they submit.`
      )
    ) {
      return;
    }
    if (!assessmentId) return;
    setBusyId(row.id);
    setBusyAction('reattempt');
    try {
      await reattempt.mutateAsync({ assessmentId, assignmentId: row.id });
      toast.success(`${name} can attempt again`);
      refetch();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Could not allow reattempt');
    } finally {
      setBusyId(null);
      setBusyAction(null);
    }
  };

  const handleHide = async (row: AssessmentAssignment) => {
    const name = row.studentName || row.studentLabel || 'this student';
    const hiding = !row.resultsHidden;
    if (
      !window.confirm(
        hiding
          ? `Hide scores for ${name}? The attempt stays, but they will not see their score until you show it again.`
          : `Show scores for ${name} again?`
      )
    ) {
      return;
    }
    if (!assessmentId) return;
    setBusyId(row.id);
    setBusyAction('hide');
    try {
      await hideResult.mutateAsync({ assessmentId, assignmentId: row.id, hidden: hiding });
      toast.success(hiding ? `Scores hidden for ${name}` : `Scores visible again for ${name}`);
      refetch();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Could not update score visibility');
    } finally {
      setBusyId(null);
      setBusyAction(null);
    }
  };

  const handleDelete = async (row: AssessmentAssignment) => {
    const name = row.studentName || row.studentLabel || 'this student';
    if (!window.confirm(`Delete ${name}'s result? This cannot be undone.`)) return;
    if (!assessmentId) return;
    setBusyId(row.id);
    setBusyAction('delete');
    try {
      await deleteResult.mutateAsync({ assessmentId, assignmentId: row.id });
      toast.success('Result deleted');
      refetch();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Could not delete result');
    } finally {
      setBusyId(null);
      setBusyAction(null);
    }
  };

  const metaBits = [
    assessment?.startAt
      ? new Date(assessment.startAt).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : null,
    assessment?.totalMarks != null ? `${assessment.totalMarks} marks` : null,
    assessment?.durationMinutes != null ? `${assessment.durationMinutes} min` : null,
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={kind === 'online_exam' ? 'Online exam results' : 'Assessment results'}
        title={assessment?.title || 'Results'}
        description={
          metaBits.length
            ? metaBits.join(' · ')
            : 'Scores for every student who has submitted.'
        }
        actions={
          <>
            <Link to={base}>
              <Button variant="secondary" size="sm">
                ← Back
              </Button>
            </Link>
            {data?.results?.length ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => downloadCsv(data.results, assessment?.title || 'assessment')}
              >
                Download CSV
              </Button>
            ) : null}
            <Button
              size="sm"
              disabled={!canAnnounce || releaseResults.isPending || isLoading}
              onClick={handleAnnounce}
            >
              {releaseResults.isPending
                ? 'Announcing…'
                : canAnnounce
                  ? released
                    ? `Announce new results (${pendingReleaseCount})`
                    : 'Announce results'
                  : released
                    ? 'Results announced'
                    : 'Announce results'}
            </Button>
            {sortedYears.length ? (
              <select
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
                value={effectiveYear}
                onChange={(e) => setYearId(e.target.value)}
              >
                {sortedYears.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.label}
                    {y.isCurrent ? ' (current)' : ''}
                  </option>
                ))}
                <option value="all">All years</option>
              </select>
            ) : null}
          </>
        }
      />

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <Skeleton className="h-64" />
        </div>
      ) : isError || !assessment ? (
        <Card className="p-8 text-center text-sm text-slate-500">
          Could not load results.{' '}
          <button type="button" className="font-medium text-brand-600 hover:underline" onClick={() => refetch()}>
            Retry
          </button>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={released && !canAnnounce ? 'success' : 'warning'}>
              {released && !canAnnounce
                ? 'Results announced'
                : canAnnounce && released
                  ? `${pendingReleaseCount} new result${pendingReleaseCount === 1 ? '' : 's'} pending announce`
                  : 'Results on hold'}
            </Badge>
            {released && assessment.resultsReleasedAt ? (
              <span className="text-xs text-slate-400">
                Last announced{' '}
                {new Date(assessment.resultsReleasedAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            ) : (
              <span className="text-xs text-slate-400">
                Students cannot see scores until you announce results.
              </span>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="p-5 text-center">
              <p className="text-3xl font-extrabold tabular-nums text-slate-900 dark:text-white">
                {summary?.submitted ?? 0}
              </p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Submitted
              </p>
            </Card>
            <Card className="p-5 text-center">
              <p className="text-3xl font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400">
                {Math.round(summary?.averagePercentage ?? 0)}%
              </p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Class average
              </p>
            </Card>
            <Card className="p-5 text-center">
              <p className="text-3xl font-extrabold tabular-nums text-amber-600 dark:text-amber-400">
                {Math.round(summary?.highestPercentage ?? 0)}%
              </p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Highest
              </p>
            </Card>
          </div>

          {!ranked.length ? (
            <Card className="p-0">
              <EmptyState
                title="No submissions yet"
                description={
                  assessment.status === 'published'
                    ? 'Students have not attempted this assessment yet.'
                    : 'This assessment is still a draft, so students cannot see it.'
                }
              />
            </Card>
          ) : (
            <Card className="overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[56rem] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900/80">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Rank</th>
                      <th className="px-4 py-3 font-semibold">Participant</th>
                      <th className="px-4 py-3 font-semibold">Actions</th>
                      <th className="px-4 py-3 font-semibold">Score</th>
                      <th className="px-4 py-3 font-semibold">%</th>
                      <th className="px-4 py-3 font-semibold">Right</th>
                      <th className="px-4 py-3 font-semibold">Wrong</th>
                      <th className="px-4 py-3 font-semibold">Skipped</th>
                      <th className="px-4 py-3 font-semibold">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {ranked.map((row) => {
                      const name = row.studentName || row.studentLabel || 'Unknown';
                      const pct = Number(row.percentage || 0);
                      const isBusy = (action: string) =>
                        busyId === row.id && busyAction === action;
                      const anyBusy = Boolean(busyId);

                      return (
                        <tr
                          key={row.id}
                          className="transition hover:bg-brand-50/40 dark:hover:bg-brand-950/20"
                        >
                          <td className="px-4 py-3 text-base font-extrabold tabular-nums text-slate-900 dark:text-white">
                            {row.status === 'submitted' ? row.rank : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-start gap-3">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-800 dark:bg-brand-900/50 dark:text-brand-200">
                                {initials(name)}
                              </span>
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-900 dark:text-white">{name}</p>
                                <p className="truncate text-xs text-slate-400">{row.studentEmail}</p>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {row.status === 'pending' ? (
                                    <Badge tone="warning">Pending</Badge>
                                  ) : null}
                                  {row.autoSubmitted ? (
                                    <Badge tone="warning">Auto-submitted</Badge>
                                  ) : null}
                                  {row.resultsHidden ? <Badge tone="neutral">Hidden</Badge> : null}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={anyBusy && !isBusy('reattempt')}
                                onClick={() => handleReattempt(row)}
                              >
                                {isBusy('reattempt') ? '…' : 'Reattempt'}
                              </Button>
                              {row.status === 'submitted' ? (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  disabled={anyBusy && !isBusy('hide')}
                                  onClick={() => handleHide(row)}
                                >
                                  {isBusy('hide') ? '…' : row.resultsHidden ? 'Show' : 'Hide'}
                                </Button>
                              ) : null}
                              <Button
                                size="sm"
                                variant="danger"
                                disabled={anyBusy && !isBusy('delete')}
                                onClick={() => handleDelete(row)}
                              >
                                {isBusy('delete') ? '…' : 'Delete'}
                              </Button>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-semibold tabular-nums text-slate-900 dark:text-white">
                            {row.status === 'submitted'
                              ? `${formatMarks(Number(row.scoredMarks ?? row.score ?? 0))} / ${formatMarks(Number(row.totalMarks ?? row.maxScore ?? 0))}`
                              : '—'}
                          </td>
                          <td
                            className={clsx(
                              'px-4 py-3 font-bold tabular-nums',
                              row.status === 'submitted' ? scoreTone(pct) : 'text-slate-400'
                            )}
                          >
                            {row.status === 'submitted' ? `${Math.round(pct)}%` : '—'}
                          </td>
                          <td className="px-4 py-3 tabular-nums text-emerald-600 dark:text-emerald-400">
                            {row.status === 'submitted' ? (
                              <>
                                {row.correctCount ?? 0}
                                {(row.partialCount || 0) > 0 ? (
                                  <span className="text-amber-600">
                                    {' '}
                                    (+{row.partialCount} partial)
                                  </span>
                                ) : null}
                              </>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-4 py-3 tabular-nums text-rose-600">
                            {row.status === 'submitted' ? row.wrongCount ?? 0 : '—'}
                          </td>
                          <td className="px-4 py-3 tabular-nums text-slate-400">
                            {row.unansweredCount ?? 0}
                          </td>
                          <td className="px-4 py-3 tabular-nums text-slate-500">
                            {row.status === 'submitted'
                              ? formatDuration(row.timeTakenSeconds)
                              : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <p className="text-xs text-slate-400">
            <Badge tone="neutral">Note</Badge>{' '}
            Announce emails tell students to open results on the website — scores are never included
            in the email. Late attempts after announce stay on hold until you announce again.
            Reattempt clears the score. Hide keeps the attempt but hides the score from the student
            until you show it again. Delete removes the result.
          </p>
        </>
      )}
    </div>
  );
}
