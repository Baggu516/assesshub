import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, EmptyState, PageHeader, Skeleton } from '@/components/ui';
import { useMyAssignmentsQuery } from '@/hooks/api/useAssessments';
import { useAcademicYearsQuery } from '@/hooks/api/useAcademicYears';

const selectClass =
  'rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm bg-white dark:bg-slate-900';

export function MyAssessmentsPage() {
  const { data: years = [], isLoading: yearsLoading } = useAcademicYearsQuery();
  const sortedYears = useMemo(
    () => [...years].sort((a, b) => b.label.localeCompare(a.label)),
    [years]
  );

  const [yearId, setYearId] = useState('');

  useEffect(() => {
    if (yearId || !sortedYears.length) return;
    const current = sortedYears.find((y) => y.isCurrent) || sortedYears[0];
    setYearId(current.id);
  }, [sortedYears, yearId]);

  const queryYear = yearId || undefined;
  const { data, isLoading } = useMyAssignmentsQuery(queryYear);
  const assignments = data?.assignments ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="My assessments"
        description="Assessments for the selected academic year. Switch years to see past work."
        actions={
          yearsLoading ? (
            <Skeleton className="h-10 w-44" />
          ) : sortedYears.length ? (
            <label className="flex items-center gap-2 text-xs text-slate-500">
              <span className="shrink-0">Academic year</span>
              <select
                className={selectClass}
                value={yearId}
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
            </label>
          ) : null
        }
      />

      {isLoading || (sortedYears.length > 0 && !yearId) ? (
        <div className="space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : assignments.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            title="No assessments yet"
            description={
              yearId === 'all'
                ? 'When your teacher assigns a quiz, it will show up here.'
                : 'No assessments for this academic year. Try another year or All years.'
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {assignments.map((a) => (
            <Card
              key={a.id}
              className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                    {a.assessmentTitle}
                  </h3>
                  <Badge tone={a.status === 'submitted' ? 'success' : 'warning'}>
                    {a.status === 'submitted' ? `Score: ${a.score}/${a.maxScore}` : 'Pending'}
                  </Badge>
                  {yearId === 'all' && a.academicYearLabel ? (
                    <Badge tone="neutral">{a.academicYearLabel}</Badge>
                  ) : null}
                </div>
                {a.dueDate && (
                  <p className="mt-1 text-xs text-slate-500">
                    Due: {new Date(a.dueDate).toLocaleString()}
                  </p>
                )}
                {a.status === 'submitted' && a.submittedAt && (
                  <p className="mt-1 text-xs text-slate-500">
                    Submitted: {new Date(a.submittedAt).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="shrink-0">
                <Link to={`/my-assessments/${a.id}`}>
                  <Button size="sm" variant={a.status === 'pending' ? 'primary' : 'secondary'}>
                    {a.status === 'pending' ? 'Start' : 'View results'}
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
