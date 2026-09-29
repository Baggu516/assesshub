import { Link, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Spinner';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { useHomeroomStudentPerformanceQuery } from '@/hooks/api/useClasses';

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function formatMarks(n: number) {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2).replace(/\.?0+$/, '');
}

function scoreTone(percentage: number | null) {
  if (percentage == null) return 'text-slate-400';
  if (percentage >= 75) return 'text-emerald-600 dark:text-emerald-400';
  if (percentage >= 40) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card dark:border-slate-700/80 dark:bg-slate-900/80">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 font-display text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </article>
  );
}

export function StudentPerformancePage() {
  const { classId, studentId } = useParams<{ classId: string; studentId: string }>();
  const { yearId } = useAcademicYear();
  const academicYearId = yearId === 'all' ? null : yearId || null;

  const { data, isLoading, isError, error } = useHomeroomStudentPerformanceQuery(
    classId,
    studentId,
    academicYearId
  );

  const errMsg =
    (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
    'Could not load student performance';

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card className="p-8 text-center text-sm text-slate-500">
        {errMsg}.{' '}
        <Link to="/my-class" className="font-medium text-brand-600 hover:underline">
          Back to My class
        </Link>
      </Card>
    );
  }

  const { student, class: klass, summary, assignments, leaderboard } = data;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        eyebrow="Student performance"
        title={student.label}
        description={`${klass.name}${klass.section ? ` · Sec ${klass.section}` : ''}${
          klass.academicYear ? ` · ${klass.academicYear}` : ''
        } · ${student.email}`}
        actions={
          <Link
            to="/my-class"
            className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            ← Back to My class
          </Link>
        }
      />

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-900 via-slate-800 to-brand-900 p-5 text-white shadow-card dark:border-slate-700">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-lg font-semibold">
            {initials(student.label)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-white/55">
              Student performance
            </p>
            <h2 className="mt-0.5 font-display text-xl font-semibold">{student.label}</h2>
            <p className="text-sm text-white/65">{student.email}</p>
          </div>
          {summary.classRank != null ? (
            <div className="rounded-xl bg-white/10 px-4 py-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-white/55">
                Class rank
              </p>
              <p className="font-display text-2xl font-semibold">
                #{summary.classRank}
                <span className="text-sm font-normal text-white/50">
                  {' '}
                  / {summary.classmatesRanked}
                </span>
              </p>
            </div>
          ) : (
            <Badge tone="neutral" className="bg-white/10 text-white">
              No ranked scores yet
            </Badge>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Assignments"
          value={summary.totalAssignments}
          hint={`${summary.submittedCount} submitted · ${summary.pendingCount} pending`}
        />
        <Metric
          label="Submitted"
          value={summary.submittedCount}
          hint="Completed turn-ins"
        />
        <Metric
          label="Average"
          value={
            summary.averagePercentage == null ? '—' : `${summary.averagePercentage}%`
          }
          hint="Across submitted work"
        />
        <Metric
          label="Class rank"
          value={summary.classRank == null ? '—' : `#${summary.classRank}`}
          hint={
            summary.classmatesRanked
              ? `Among ${summary.classmatesRanked} classmates with scores`
              : 'Needs at least one submitted score'
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card className="overflow-hidden p-0">
          <div className="border-b border-slate-100 px-5 py-3.5 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              All assignments
            </h3>
            <p className="text-xs text-slate-500">
              Scores and rank among classmates who submitted the same work.
            </p>
          </div>
          {!assignments.length ? (
            <div className="p-8">
              <EmptyState
                title="No assignments yet"
                description="When this student is assigned assessments or exams, they will appear here."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-900/80">
                  <tr>
                    <th className="px-5 py-2.5 font-medium">Title</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium">Score</th>
                    <th className="px-4 py-2.5 font-medium">%</th>
                    <th className="px-5 py-2.5 font-medium">Class rank</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {assignments.map((a) => (
                    <tr key={a.id} className="bg-white dark:bg-slate-950/40">
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-900 dark:text-white">{a.title}</p>
                        <p className="text-[11px] text-slate-400">
                          {a.kind === 'online_exam' ? 'Online exam' : 'Assessment'}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={a.status === 'submitted' ? 'success' : 'warning'}>
                          {a.status === 'submitted' ? 'Submitted' : 'Pending'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {a.status === 'submitted'
                          ? `${formatMarks(a.score ?? 0)} / ${formatMarks(a.maxScore)}`
                          : '—'}
                      </td>
                      <td
                        className={clsx(
                          'px-4 py-3 font-semibold',
                          scoreTone(a.percentage)
                        )}
                      >
                        {a.percentage == null ? '—' : `${Math.round(a.percentage)}%`}
                      </td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                        {a.classRank != null
                          ? `#${a.classRank} / ${a.classSubmittedCount}`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="border-b border-slate-100 px-5 py-3.5 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Class leaderboard
            </h3>
            <p className="text-xs text-slate-500">
              Ranked by average % across submitted assignments.
            </p>
          </div>
          {!leaderboard.length ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">
              No class scores to rank yet.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {leaderboard.map((row) => (
                <li
                  key={row.studentId}
                  className={clsx(
                    'flex items-center gap-3 px-5 py-3',
                    row.isTarget && 'bg-brand-50/80 dark:bg-brand-500/10'
                  )}
                >
                  <span
                    className={clsx(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                      row.rank === 1
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                    )}
                  >
                    {row.rank ?? '—'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={clsx(
                        'truncate text-sm font-medium',
                        row.isTarget
                          ? 'text-brand-800 dark:text-brand-200'
                          : 'text-slate-900 dark:text-white'
                      )}
                    >
                      {row.label}
                      {row.isTarget ? ' (this student)' : ''}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {row.submittedCount} submitted
                    </p>
                  </div>
                  <span className={clsx('text-sm font-semibold', scoreTone(row.averagePercentage))}>
                    {row.averagePercentage}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
