import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { Toggle } from '@/components/ui/Toggle';
import type { StudentAccess } from '@/types/user';

type PlanId = 'monthly' | 'quarterly' | 'yearly';

type Plan = {
  id: PlanId;
  label: string;
  amountPaise: number;
  periodDays: number;
};

type Insights = {
  students: number;
  active: number;
  trial: number;
  expired: number;
  pending: number;
  suspended: number;
  paidThisMonth: number;
  collectedThisMonthPaise: number;
  commissionThisMonthPaise: number;
  clients: number;
  billingOn: number;
};

type ClientRow = {
  id: string;
  name: string;
  subdomain: string;
  logoUrl?: string | null;
  isActive: boolean;
  studentBillingEnabled: boolean;
  loadError: boolean;
  students: number;
  active: number;
  trial: number;
  expired: number;
  pending: number;
  suspended: number;
  paidThisMonth: number;
  collectedThisMonthPaise: number;
  commissionPerStudentPaise: number;
  commissionThisMonthPaise: number;
};

type LastPayment = {
  paidAt: string;
  provider: 'razorpay' | 'dev' | 'master';
  planId: PlanId | null;
  amountPaise: number;
};

type StudentRow = {
  id: string;
  email: string;
  registrationId: string | null;
  name: string;
  isActive: boolean;
  access: StudentAccess;
  paidThisMonth: boolean;
  lastPayment: LastPayment | null;
};

type Overview = {
  plans: Plan[];
  insights: Insights;
  clients: ClientRow[];
};

type StudentStatus = 'all' | 'active' | 'trial' | 'expired' | 'suspended' | 'pending';

const PLAN_LABEL: Record<PlanId, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

function formatInr(paise: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

function formatDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function statusBadge(access: StudentAccess) {
  if (access.status === 'active') return <Badge tone="success">Paid</Badge>;
  if (access.status === 'trial') return <Badge tone="warning">Trial · {access.daysLeft ?? 0}d</Badge>;
  if (access.status === 'expired') return <Badge tone="danger">Payment due</Badge>;
  if (access.status === 'suspended') return <Badge tone="danger">Disabled</Badge>;
  if (access.status === 'pending') return <Badge tone="neutral">Not started</Badge>;
  return <Badge tone="neutral">—</Badge>;
}

function orgInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function SubscriptionsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [clientQuery, setClientQuery] = useState('');

  const overview = useQuery({
    queryKey: ['platform-subscriptions'],
    queryFn: async () => {
      const { data } = await api.get<Overview>('/platform/subscriptions');
      return data;
    },
  });

  const clients = overview.data?.clients ?? [];

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ['platform-subscriptions'] });
  };

  const billingMutation = useMutation({
    mutationFn: async ({ id, studentBillingEnabled }: { id: string; studentBillingEnabled: boolean }) => {
      await api.patch(`/platform/subscriptions/${id}`, { studentBillingEnabled });
    },
    onSuccess: () => {
      toast.success('Billing updated');
      void refresh();
    },
    onError: () => toast.error('Could not update billing'),
  });

  const filteredClients = useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (client) => client.name.toLowerCase().includes(q) || client.subdomain.toLowerCase().includes(q)
    );
  }, [clients, clientQuery]);

  const insights = overview.data?.insights;

  if (overview.error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
        Could not load subscriptions.
      </div>
    );
  }

  const stats = [
    { label: 'Active now', value: insights?.active, hint: 'On a paid plan', tone: 'text-emerald-700 dark:text-emerald-300' },
    { label: 'Paid this month', value: insights?.paidThisMonth, hint: 'Students who paid', tone: 'text-brand-700 dark:text-brand-300' },
    {
      label: 'School commission',
      value: overview.isLoading ? undefined : formatInr(insights?.commissionThisMonthPaise || 0),
      hint: 'Owed from paid students',
      tone: 'text-emerald-700 dark:text-emerald-300',
    },
    { label: 'On trial', value: insights?.trial, hint: 'Inside 7 free days', tone: 'text-amber-700 dark:text-amber-300' },
    { label: 'Payment due', value: insights?.expired, hint: 'Trial ended', tone: 'text-rose-700 dark:text-rose-300' },
  ];

  return (
    <div className="ah-page">
      <PageHeader
        eyebrow="Master registry"
        title="Subscription management"
        description="See which schools have students on a trial or a paid plan. Open a school to assign or turn access on and off."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-3 shadow-soft backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-900/50"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{stat.label}</p>
            <p className={`mt-1 font-display text-2xl font-bold tracking-tight ${stat.tone}`}>
              {overview.isLoading || stat.value === undefined ? '—' : stat.value}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">{stat.hint}</p>
          </div>
        ))}
      </div>

      <p className="text-sm text-slate-500 dark:text-slate-400">
        {overview.isLoading
          ? 'Loading schools…'
          : `${insights?.students ?? 0} students across ${insights?.clients ?? 0} schools · ${insights?.suspended ?? 0} disabled · ${insights?.billingOn ?? 0} schools require payment`}
      </p>

      <div className="ah-table-wrap">
        <div className="flex flex-col gap-3 border-b border-slate-200/80 p-4 dark:border-slate-700/80 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Clients</h2>
          <Input
            value={clientQuery}
            onChange={(e) => setClientQuery(e.target.value)}
            placeholder="Search schools…"
            className="max-w-xs"
          />
        </div>
        <div className="overflow-x-auto">
          {!filteredClients.length ? (
            <EmptyState title="No clients" description="Schools you create will show up here." />
          ) : (
            <table className="ah-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Students</th>
                  <th>Paid now</th>
                  <th>Trial</th>
                  <th>Due</th>
                  <th>Paid this month</th>
                  <th>Commission</th>
                  <th>Require payment</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((client) => (
                  <tr
                    key={client.id}
                    onClick={() => navigate(`/subscriptions/${client.id}`)}
                    className="cursor-pointer"
                  >
                    <td>
                      <div className="flex items-center gap-3">
                        {client.logoUrl ? (
                          <img src={client.logoUrl} alt="" className="h-9 w-9 rounded-lg object-cover" />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-xs font-bold text-white">
                            {orgInitials(client.name)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{client.name}</p>
                          <p className="truncate text-xs text-slate-500">{client.subdomain}</p>
                        </div>
                      </div>
                    </td>
                    <td className="tabular-nums">{client.students}</td>
                    <td className="tabular-nums">{client.active}</td>
                    <td className="tabular-nums">{client.trial}</td>
                    <td className="tabular-nums">{client.expired}</td>
                    <td className="tabular-nums">{client.paidThisMonth}</td>
                    <td>
                      <p className="text-sm font-medium tabular-nums text-slate-900 dark:text-white">
                        {formatInr(client.commissionThisMonthPaise || 0)}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {formatInr(client.commissionPerStudentPaise || 0)} / student
                      </p>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <Toggle
                        checked={client.studentBillingEnabled}
                        disabled={billingMutation.isPending}
                        aria-label={`Require payment for ${client.name}`}
                        onChange={(next) => billingMutation.mutate({ id: client.id, studentBillingEnabled: next })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export function SubscriptionStudentsPage() {
  const { orgId = '' } = useParams();
  const qc = useQueryClient();
  const [studentQuery, setStudentQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StudentStatus>('all');
  const [assignTarget, setAssignTarget] = useState<StudentRow | null>(null);
  const [commissionInput, setCommissionInput] = useState('');

  const overview = useQuery({
    queryKey: ['platform-subscriptions'],
    queryFn: async () => {
      const { data } = await api.get<Overview>('/platform/subscriptions');
      return data;
    },
  });

  const studentsQuery = useQuery({
    queryKey: ['platform-subscription-students', orgId],
    queryFn: async () => {
      const { data } = await api.get<{ organization: ClientRow; students: StudentRow[] }>(
        `/platform/subscriptions/${orgId}`
      );
      return data;
    },
    enabled: Boolean(orgId),
  });

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ['platform-subscriptions'] });
    await qc.invalidateQueries({ queryKey: ['platform-subscription-students', orgId] });
  };

  const accessMutation = useMutation({
    mutationFn: async ({
      orgId,
      userId,
      suspended,
    }: {
      orgId: string;
      userId: string;
      suspended: boolean;
    }) => {
      const { data } = await api.post<{ access: StudentAccess }>(
        `/platform/subscriptions/${orgId}/students/${userId}/access`,
        { suspended }
      );
      return data.access;
    },
    onSuccess: (access, vars) => {
      qc.setQueryData<{ organization: ClientRow; students: StudentRow[] }>(
        ['platform-subscription-students', vars.orgId],
        (current) => {
          if (!current) return current;
          return {
            ...current,
            students: current.students.map((student) =>
              student.id === vars.userId ? { ...student, access } : student
            ),
          };
        }
      );
      toast.success(vars.suspended ? 'Subscription disabled' : 'Subscription enabled');
      void qc.invalidateQueries({ queryKey: ['platform-subscriptions'] });
      void qc.invalidateQueries({ queryKey: ['platform-subscription-students', vars.orgId] });
    },
    onError: () => toast.error('Could not update this student'),
  });

  const assignMutation = useMutation({
    mutationFn: async ({ userId, planId }: { userId: string; planId: PlanId }) => {
      await api.post(`/platform/subscriptions/${orgId}/students/${userId}/assign`, { planId });
    },
    onSuccess: () => {
      toast.success('Subscription assigned');
      setAssignTarget(null);
      void refresh();
    },
    onError: () => toast.error('Could not assign the plan'),
  });

  const students = studentsQuery.data?.students ?? [];
  const filteredStudents = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    return students.filter((student) => {
      if (statusFilter !== 'all' && student.access.status !== statusFilter) return false;
      if (!q) return true;
      return (
        student.name.toLowerCase().includes(q) ||
        student.email.toLowerCase().includes(q) ||
        (student.registrationId || '').toLowerCase().includes(q)
      );
    });
  }, [students, studentQuery, statusFilter]);

  const school = studentsQuery.data?.organization;
  const plans = overview.data?.plans ?? [];

  useEffect(() => {
    if (!school) return;
    setCommissionInput(String((school.commissionPerStudentPaise || 0) / 100));
  }, [school?.id, school?.commissionPerStudentPaise]);

  const commissionMutation = useMutation({
    mutationFn: async (rupees: number) => {
      await api.patch(`/platform/subscriptions/${orgId}`, { commissionPerStudentRupees: rupees });
    },
    onSuccess: () => {
      toast.success('Commission saved');
      void refresh();
    },
    onError: () => toast.error('Could not save commission'),
  });

  if (studentsQuery.error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
        Could not load students for this school.
      </div>
    );
  }

  return (
    <div className="ah-page">
      <Link
        to="/subscriptions"
        className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-600 dark:text-brand-300"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        All schools
      </Link>
      <PageHeader
        eyebrow="Subscription management"
        title={school?.name || 'Students'}
        description={
          school
            ? school.studentBillingEnabled
              ? 'Students must be on a trial or a paid plan. Assign a plan or turn access on and off.'
              : 'Payment is off for this school. Students are not blocked. You can still assign a plan.'
            : 'Loading this school…'
        }
      />

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-3 dark:border-slate-700/80 dark:bg-slate-900/50">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Students paid this month</p>
          <p className="mt-1 font-display text-2xl font-bold text-slate-900 dark:text-white">
            {school ? school.paidThisMonth : '—'}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            Collected {school ? formatInr(school.collectedThisMonthPaise || 0) : '—'}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-3 dark:border-slate-700/80 dark:bg-slate-900/50">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Commission to school</p>
          <p className="mt-1 font-display text-2xl font-bold text-emerald-700 dark:text-emerald-300">
            {school ? formatInr(school.commissionThisMonthPaise || 0) : '—'}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            {school ? `${school.paidThisMonth} paid × ${formatInr(school.commissionPerStudentPaise || 0)}` : 'Set a rate per paid student'}
          </p>
        </div>
        <form
          className="rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-3 dark:border-slate-700/80 dark:bg-slate-900/50"
          onSubmit={(e) => {
            e.preventDefault();
            const rupees = Number(commissionInput);
            if (!Number.isFinite(rupees) || rupees < 0) {
              toast.error('Enter a commission amount');
              return;
            }
            commissionMutation.mutate(rupees);
          }}
        >
          <label htmlFor="school-commission" className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Per paid student (₹)
          </label>
          <div className="mt-2 flex gap-2">
            <Input
              id="school-commission"
              type="number"
              min={0}
              step="1"
              value={commissionInput}
              onChange={(e) => setCommissionInput(e.target.value)}
            />
            <Button type="submit" disabled={commissionMutation.isPending}>
              Save
            </Button>
          </div>
          <p className="mt-2 text-xs text-slate-400">Plans you assign here are not counted. Only students who paid.</p>
        </form>
      </div>

      <div className="ah-table-wrap">
        <div className="flex flex-col gap-3 border-b border-slate-200/80 p-4 dark:border-slate-700/80 sm:px-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Students</h2>
              <p className="text-xs text-slate-500">
                {school ? `${school.students} students · ${school.subdomain}` : 'Student subscriptions'}
              </p>
            </div>
            <Input
              value={studentQuery}
              onChange={(e) => setStudentQuery(e.target.value)}
              placeholder="Search name, email, or ID…"
              className="max-w-xs"
            />
          </div>
          <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/80 w-fit">
            {(
              [
                ['all', 'All'],
                ['active', 'Paid'],
                ['trial', 'Trial'],
                ['expired', 'Due'],
                ['suspended', 'Disabled'],
                ['pending', 'Not started'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                className={
                  statusFilter === key
                    ? 'rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                    : 'rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          {studentsQuery.isLoading ? (
            <p className="px-5 py-8 text-sm text-slate-500">Loading students…</p>
          ) : !filteredStudents.length ? (
            <EmptyState title="No students" description="No students match this school and filter." />
          ) : (
            <table className="ah-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Access until</th>
                  <th>Last activity</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => {
                  const planId = student.access.planId;
                  const until =
                    student.access.status === 'active'
                      ? student.access.subscriptionEndsAt
                      : student.access.status === 'trial'
                        ? student.access.trialEndsAt
                        : student.access.subscriptionEndsAt || student.access.trialEndsAt;
                  return (
                    <tr key={student.id}>
                      <td>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          {student.name || student.email}
                        </p>
                        <p className="text-xs text-slate-500">{student.email}</p>
                        {student.registrationId ? (
                          <p className="font-mono text-[11px] text-brand-700 dark:text-brand-300">
                            ID {student.registrationId}
                          </p>
                        ) : null}
                      </td>
                      <td>{planId ? PLAN_LABEL[planId] : '—'}</td>
                      <td>{statusBadge(student.access)}</td>
                      <td>{formatDate(until)}</td>
                      <td>
                        {student.lastPayment ? (
                          <div>
                            <p className="text-sm text-slate-700 dark:text-slate-200">
                              {student.lastPayment.provider === 'master' ? 'Assigned' : 'Paid'}{' '}
                              {formatDate(student.lastPayment.paidAt)}
                            </p>
                            {student.paidThisMonth ? (
                              <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                                Paid this month
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">No payment</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="secondary" onClick={() => setAssignTarget(student)}>
                            Assign
                          </Button>
                          <Button
                            size="sm"
                            variant={student.access.suspended || student.access.status === 'suspended' ? 'primary' : 'danger'}
                            disabled={accessMutation.isPending}
                            onClick={() => {
                              const suspended = !(student.access.suspended || student.access.status === 'suspended');
                              accessMutation.mutate({ orgId, userId: student.id, suspended });
                            }}
                          >
                            {student.access.suspended || student.access.status === 'suspended' ? 'Enable' : 'Disable'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Modal
        open={Boolean(assignTarget)}
        onClose={() => setAssignTarget(null)}
        title="Assign subscription"
        description={
          assignTarget
            ? `Give ${assignTarget.name || assignTarget.email} a plan. Remaining trial days stay, then this plan starts.`
            : undefined
        }
      >
        <div className="grid gap-3">
          {plans.map((plan) => (
            <button
              key={plan.id}
              type="button"
              disabled={assignMutation.isPending}
              onClick={() => assignTarget && assignMutation.mutate({ userId: assignTarget.id, planId: plan.id })}
              className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-left hover:border-brand-400 hover:bg-brand-50/50 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-brand-500/10"
            >
              <span>
                <span className="block text-sm font-semibold text-slate-900 dark:text-white">{plan.label}</span>
                <span className="text-xs text-slate-500">
                  {plan.periodDays === 30 ? '30 days' : plan.periodDays === 90 ? '90 days' : '1 year'}
                </span>
              </span>
              <span className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                {formatInr(plan.amountPaise)}
              </span>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
