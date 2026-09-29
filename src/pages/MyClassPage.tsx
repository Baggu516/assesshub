import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Spinner';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { useHomeroomClassesQuery, type SchoolClass } from '@/hooks/api/useClasses';

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function MyClassPage() {
  const { yearId, isLoading: yearsLoading } = useAcademicYear();
  const ready = !yearsLoading;
  const effectiveYearId = yearId === 'all' ? null : yearId || null;

  const { data: classes = [], isLoading } = useHomeroomClassesQuery(ready, effectiveYearId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const sorted = useMemo(
    () => [...classes].sort((a, b) => a.name.localeCompare(b.name)),
    [classes]
  );

  useEffect(() => {
    if (!sorted.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !sorted.some((c) => c.id === selectedId)) {
      setSelectedId(sorted[0].id);
    }
  }, [sorted, selectedId]);

  const selected: SchoolClass | null = sorted.find((c) => c.id === selectedId) || null;

  const students = useMemo(() => {
    const rows = selected?.students || [];
    const q = query.trim().toLowerCase();
    const filtered = q
      ? rows.filter(
          (s) =>
            s.label.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
        )
      : rows;
    return [...filtered].sort((a, b) => a.label.localeCompare(b.label));
  }, [selected, query]);

  const teachers = useMemo(() => {
    const rows = selected?.teachers || [];
    return [...rows].sort((a, b) => a.label.localeCompare(b.label));
  }, [selected]);

  const selectClass = (id: string) => {
    setSelectedId(id);
    setQuery('');
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="My class"
        description="Track your homeroom — open any student to see assignments, scores, and class rank."
      />

      {isLoading || !ready ? (
        <div className="space-y-3">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      ) : sorted.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            title="No homeroom classes yet"
            description="When an admin marks you as class teacher on a class, it will show up here."
          />
        </Card>
      ) : selected ? (
        <div className="space-y-5">
          {sorted.length > 1 ? (
            <div
              role="tablist"
              aria-label="Your classes"
              className="flex flex-wrap gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-1.5 dark:border-slate-700 dark:bg-slate-900/50"
            >
              {sorted.map((c) => {
                const active = c.id === selectedId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => selectClass(c.id)}
                    className={clsx(
                      'rounded-xl px-4 py-2.5 text-left transition',
                      active
                        ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-800 dark:text-white dark:ring-slate-600'
                        : 'text-slate-500 hover:bg-white/70 hover:text-slate-800 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'
                    )}
                  >
                    <span className="block text-sm font-semibold">{c.name}</span>
                    <span className="mt-0.5 block text-[11px] text-slate-400">
                      {c.studentCount} student{c.studentCount !== 1 ? 's' : ''}
                      {c.section ? ` · Sec ${c.section}` : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}

          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card dark:border-slate-700/80 dark:bg-slate-900/80 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-700 dark:text-brand-300">
                  Homeroom
                </p>
                <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
                  {selected.name}
                </h2>
                <p className="mt-1.5 text-sm text-slate-500">
                  {[
                    selected.section ? `Section ${selected.section}` : null,
                    selected.academicYear || null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'Academic class'}
                </p>
                {selected.description ? (
                  <p className="mt-2 max-w-xl text-sm text-slate-400">{selected.description}</p>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-3">
                <div className="min-w-[88px] rounded-xl bg-slate-50 px-3.5 py-2.5 dark:bg-slate-800/80">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Students
                  </p>
                  <p className="mt-0.5 font-display text-2xl font-semibold text-slate-900 dark:text-white">
                    {selected.studentCount}
                  </p>
                </div>
                <div className="min-w-[88px] rounded-xl bg-slate-50 px-3.5 py-2.5 dark:bg-slate-800/80">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Teachers
                  </p>
                  <p className="mt-0.5 font-display text-2xl font-semibold text-slate-900 dark:text-white">
                    {selected.teacherCount}
                  </p>
                </div>
              </div>
            </div>

            {teachers.length > 0 ? (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                <span className="text-xs font-medium text-slate-400">Teachers</span>
                {teachers.map((t) => {
                  const isHomeroom = selected.classTeacherId === t.id;
                  return (
                    <span
                      key={t.id}
                      title={t.email}
                      className={clsx(
                        'rounded-lg px-2.5 py-1 text-xs font-medium',
                        isHomeroom
                          ? 'bg-brand-50 text-brand-800 ring-1 ring-brand-200/80 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-500/30'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                      )}
                    >
                      {t.label}
                      {isHomeroom ? ' · you' : ''}
                    </span>
                  );
                })}
              </div>
            ) : null}
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card dark:border-slate-700/80 dark:bg-slate-900/80">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800 sm:px-6">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">Students</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {students.length} shown
                  {query.trim() ? ` for “${query.trim()}”` : ''} · open one to view performance
                </p>
              </div>
              <Input
                placeholder="Search by name or email…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full max-w-xs"
              />
            </div>

            {students.length === 0 ? (
              <p className="px-5 py-12 text-center text-sm text-slate-500 sm:px-6">
                {query.trim()
                  ? 'No students match that search.'
                  : 'No students enrolled in this class yet.'}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {students.map((s, index) => (
                  <li key={s.id}>
                    <Link
                      to={`/my-class/${selected.id}/students/${s.id}`}
                      className="group flex items-center gap-3 px-5 py-3.5 transition hover:bg-brand-50/40 dark:hover:bg-brand-500/[0.06] sm:px-6"
                    >
                      <span className="w-6 shrink-0 text-center text-xs tabular-nums text-slate-300 dark:text-slate-600">
                        {index + 1}
                      </span>
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {initials(s.label)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                          {s.label}
                        </p>
                        <p className="truncate text-xs text-slate-500">{s.email}</p>
                      </div>
                      <span className="shrink-0 text-xs font-semibold text-brand-700 opacity-0 transition group-hover:opacity-100 dark:text-brand-300 sm:opacity-100">
                        View performance →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
