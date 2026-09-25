import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { Skeleton } from '@/components/ui/Spinner';
import { useDashboardQuery } from '@/hooks/api/useDashboard';
import type { OrgDashboard, StudentDashboard, TeacherDashboard } from '@/hooks/api/useDashboard';

function isOrg(d: { scope: string }): d is OrgDashboard {
  return d.scope === 'organization';
}
function isTeacher(d: { scope: string }): d is TeacherDashboard {
  return d.scope === 'teacher';
}
function isStudent(d: { scope: string }): d is StudentDashboard {
  return d.scope === 'student';
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning 😇';
  if (hour < 17) return 'Good afternoon 😊';
  return 'Good evening 😉';
}

function Ring({ percent }: { percent: number }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, percent)) / 100) * c;
  return (
    <svg viewBox="0 0 108 108" className="h-28 w-28 shrink-0" aria-hidden>
      <circle cx="54" cy="54" r={r} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="10" />
      <circle
        cx="54"
        cy="54"
        r={r}
        fill="none"
        stroke="#99f6e4"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 54 54)"
      />
      <text x="54" y="50" textAnchor="middle" fill="white" fontSize="20" fontWeight="650">
        {percent}%
      </text>
      <text x="54" y="68" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="10">
        complete
      </text>
    </svg>
  );
}

function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint: string;
  tone: 'teal' | 'indigo' | 'amber' | 'emerald';
}) {
  const dots = {
    teal: 'bg-teal-500',
    indigo: 'bg-indigo-500',
    amber: 'bg-amber-500',
    emerald: 'bg-emerald-500',
  };
  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card dark:border-slate-700/80 dark:bg-slate-900/80">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <span className={`mt-1.5 h-2.5 w-2.5 rounded-full ${dots[tone]}`} />
      </div>
      <p className="mt-3 font-display text-4xl font-semibold tracking-tight text-slate-900 dark:text-white">{value}</p>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{hint}</p>
    </article>
  );
}

function Shortcut({ to, title, hint }: { to: string; title: string; hint: string }) {
  return (
    <Link
      to={to}
      className="group flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3.5 transition hover:border-brand-300 hover:shadow-soft dark:border-slate-700/80 dark:bg-slate-900/70 dark:hover:border-brand-700"
    >
      <span>
        <span className="block text-sm font-semibold text-slate-900 dark:text-white">{title}</span>
        <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{hint}</span>
      </span>
      <span className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600 dark:text-slate-600" aria-hidden>
        →
      </span>
    </Link>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const { yearId, label, isLoading: yearsLoading, sortedYears } = useAcademicYear();
  const ready = !yearsLoading && (sortedYears.length === 0 || Boolean(yearId));
  const { data, isLoading } = useDashboardQuery(yearId || undefined, ready);

  const first = user?.firstName?.trim();
  const name = first || user?.email?.split('@')[0] || 'there';
  const role =
    user?.hierarchyRole === 'admin' ? 'School admin' : user?.hierarchyRole === 'subordinate' ? 'Teacher' : 'Student';
  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  if (!ready || isLoading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 rounded-3xl" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
        </div>
      </div>
    );
  }

  const yearLine = label || data.academicYear?.label || 'Current year';

  let metrics: { label: string; value: string | number; hint: string; tone: 'teal' | 'indigo' | 'amber' | 'emerald' }[] = [];
  let percent = 0;
  let insightTitle = '';
  let insightBody = '';
  let shortcuts: { to: string; title: string; hint: string }[] = [];

  if (isOrg(data)) {
    const publishRate = data.totalAssessments ? Math.round((data.publishedAssessments / data.totalAssessments) * 100) : 0;
    percent = publishRate;
    insightTitle = 'Publishing';
    insightBody = data.totalAssessments
      ? `${data.publishedAssessments} of ${data.totalAssessments} assessments are published. ${data.submissionsThisMonth} submissions came in this month.`
      : 'No assessments yet for this view. Create a class, then publish the first assessment.';
    metrics = [
      { label: 'Teachers', value: data.totalTeachers, hint: 'Active teacher accounts', tone: 'teal' },
      { label: 'Students', value: data.totalStudents, hint: 'Active student accounts', tone: 'indigo' },
      { label: 'Assessments', value: data.totalAssessments, hint: `${data.publishedAssessments} published`, tone: 'amber' },
      { label: 'Submissions', value: data.submissionsThisMonth, hint: 'Submitted this month', tone: 'emerald' },
    ];
    shortcuts = [
      { to: '/users', title: 'Students', hint: 'Accounts and enrollment' },
      { to: '/subordinates', title: 'Teachers', hint: 'Staff you manage' },
      { to: '/classes', title: 'Classes', hint: 'Grades and sections' },
      { to: '/academic-years', title: 'Academic years', hint: 'Open and current years' },
    ];
  } else if (isTeacher(data)) {
    percent = data.publishedAssessments ? Math.round((data.completedAssessments / data.publishedAssessments) * 100) : 0;
    insightTitle = 'Class completion';
    insightBody = data.publishedAssessments
      ? `${data.completedAssessments} of ${data.publishedAssessments} published assessments are fully submitted.`
      : 'Nothing published in this year yet. Drafts stay private until you publish them.';
    metrics = [
      { label: 'Created', value: data.totalAssessments, hint: 'Assessments you own', tone: 'teal' },
      { label: 'Published', value: data.publishedAssessments, hint: 'Visible to students', tone: 'indigo' },
      { label: 'Completed', value: data.completedAssessments, hint: 'Every assignee submitted', tone: 'emerald' },
      {
        label: 'Still open',
        value: Math.max(0, data.publishedAssessments - data.completedAssessments),
        hint: 'Published, not fully in',
        tone: 'amber',
      },
    ];
    shortcuts = [
      { to: '/users', title: 'My students', hint: 'Roster by class' },
      { to: '/assessments', title: 'Assessments', hint: 'Build and assign' },
      { to: '/online-exams', title: 'Online exams', hint: 'Timed CBT sessions' },
      { to: '/group-students', title: 'Groups', hint: 'Assign by group' },
    ];
  } else if (isStudent(data)) {
    percent = data.assignedAssessments ? Math.round((data.submittedAssessments / data.assignedAssessments) * 100) : 0;
    insightTitle = 'Your progress';
    insightBody = data.assignedAssessments
      ? `${data.submittedAssessments} of ${data.assignedAssessments} submitted. Average score is ${data.averageScorePercent}%.`
      : 'No assessments in this year yet. Your teacher’s assignments will show up here.';
    metrics = [
      { label: 'Assigned', value: data.assignedAssessments, hint: 'Waiting on your list', tone: 'teal' },
      { label: 'Pending', value: data.pendingAssessments, hint: 'Still to attempt', tone: 'amber' },
      { label: 'Submitted', value: data.submittedAssessments, hint: 'Turned in', tone: 'emerald' },
      { label: 'Average score', value: `${data.averageScorePercent}%`, hint: 'Across submitted work', tone: 'indigo' },
    ];
    shortcuts = [
      { to: '/my-assessments', title: 'My assessments', hint: 'Open and submit' },
      { to: '/my-online-exams', title: 'Online exams', hint: 'Fullscreen CBT' },
      { to: '/profile', title: 'Profile', hint: 'Your account' },
    ];
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-card dark:border-slate-700/80 dark:bg-slate-900">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-brand-400/20 blur-3xl dark:bg-brand-500/10" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-cyan-300/20 blur-3xl dark:bg-cyan-500/10" />
        <div className="relative flex flex-col gap-6 p-6 sm:flex-row sm:items-end sm:justify-between sm:p-8">
          <div>
            <p className="text-sm font-medium text-brand-700 dark:text-brand-300">
              {greeting()} · {role}
            </p>
            <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              {name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {today}
                <span className="mx-2 text-slate-300 dark:text-slate-600">·</span>
                {yearLine}
              </p>
              {isStudent(data) ? (
                <span
                  className={
                    data.className
                      ? 'rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-800 dark:bg-brand-500/15 dark:text-brand-200'
                      : 'rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                  }
                >
                  {data.className || 'No class this year'}
                </span>
              ) : null}
            </div>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            Switch academic year from the sidebar. Every figure on this page follows that year.
          </p>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((m) => (
          <Metric key={m.label} {...m} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <section className="relative overflow-hidden rounded-3xl bg-slate-900 p-6 text-white shadow-card dark:bg-slate-950 lg:col-span-2">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand-500/30 blur-2xl" />
          <div className="relative flex items-center gap-5">
            <Ring percent={percent} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-200">{insightTitle}</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-200">{insightBody}</p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-5 dark:border-slate-700/80 dark:bg-slate-900/40 lg:col-span-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Continue</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Jump back into the work for this year.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {shortcuts.map((s) => (
              <Shortcut key={s.to} {...s} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
