import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Spinner';
import { useClassesQuery, useClassMutations, type SchoolClass } from '@/hooks/api/useClasses';
import { useAcademicYearsQuery } from '@/hooks/api/useAcademicYears';

export function ClassesPage() {
  const navigate = useNavigate();
  const { data: years = [] } = useAcademicYearsQuery();
  const currentYear = useMemo(
    () => years.find((y) => y.isCurrent) || years[0] || null,
    [years]
  );
  const [yearFilter, setYearFilter] = useState<string>('');
  const effectiveYearId = yearFilter === 'all' ? null : yearFilter || currentYear?.id || null;

  const { data: classes = [], isLoading } = useClassesQuery(true, effectiveYearId);
  const { remove } = useClassMutations();

  const sorted = useMemo(
    () => [...classes].sort((a, b) => a.name.localeCompare(b.name)),
    [classes]
  );

  const handleDelete = async (klass: SchoolClass) => {
    if (!window.confirm(`Archive class "${klass.name}"? Enrollments are ended; history is kept.`)) return;
    try {
      await remove.mutateAsync(klass.id);
      toast.success('Class archived');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Failed to archive class');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Academic classes"
        description="A class is a grade + section for one academic year. Students enroll here — history is preserved across promotions."
        actions={
          <Button
            onClick={() =>
              navigate(
                effectiveYearId ? `/classes/new?year=${effectiveYearId}` : '/classes/new'
              )
            }
            disabled={!years.length}
          >
            New class
          </Button>
        }
      />

      {!years.length ? (
        <Card className="p-6 text-sm text-slate-500">
          Create an academic year first under <span className="font-medium">Academic years</span>, then
          add class masters, then open classes here.
        </Card>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-500">
            Year
            <select
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              value={yearFilter === 'all' ? 'all' : effectiveYearId || ''}
              onChange={(e) => setYearFilter(e.target.value)}
            >
              <option value="all">All years</option>
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.label}
                  {y.isCurrent ? ' (current)' : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : sorted.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-500">
          No academic classes for this year yet. Create one from a class master and section.
        </Card>
      ) : (
        <div className="space-y-3">
          {sorted.map((c) => (
            <Card
              key={c.id}
              className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-start"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium text-slate-900 dark:text-white">{c.name}</h3>
                  {c.academicYear ? <Badge tone="neutral">{c.academicYear}</Badge> : null}
                  {c.section ? <Badge tone="neutral">Sec {c.section}</Badge> : null}
                  <Badge tone="info">
                    {c.teacherCount} teacher{c.teacherCount !== 1 ? 's' : ''}
                  </Badge>
                  <Badge tone="info">
                    {c.studentCount} student{c.studentCount !== 1 ? 's' : ''}
                  </Badge>
                </div>
                {c.description ? <p className="mt-1 text-xs text-slate-500">{c.description}</p> : null}
                {c.teachers && c.teachers.length > 0 ? (
                  <p className="mt-2 text-xs text-slate-500">
                    <span className="font-medium text-slate-600 dark:text-slate-400">Teachers: </span>
                    {c.teachers.map((t) => t.label).join(', ')}
                  </p>
                ) : null}
                {c.students && c.students.length > 0 ? (
                  <p className="mt-1 text-xs text-slate-500">
                    <span className="font-medium text-slate-600 dark:text-slate-400">Students: </span>
                    {c.students.map((s) => s.label).join(', ')}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="secondary" onClick={() => navigate(`/classes/${c.id}/edit`)}>
                  Edit
                </Button>
                <Button variant="secondary" onClick={() => handleDelete(c)}>
                  Archive
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
