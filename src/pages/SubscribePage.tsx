import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { FullPageSpinner } from '@/components/ui/Spinner';
import type { StudentAccess } from '@/types/user';

type CheckoutMode = 'razorpay' | 'dev' | 'unconfigured';
type PlanId = 'monthly' | 'quarterly' | 'yearly';

type StudentPlan = {
  id: PlanId;
  label: string;
  amountPaise: number;
  periodDays: number;
  currency: string;
  trialDays: number;
};

type BillingStatus = {
  access: StudentAccess;
  trialDays: number;
  checkout: CheckoutMode;
  plans: StudentPlan[];
};

type CheckoutResponse = {
  mode: 'razorpay' | 'dev';
  keyId?: string;
  paymentId: string;
  orderId: string;
  amountPaise: number;
  currency: string;
  plan: StudentPlan;
};

type RazorpaySuccess = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function formatInr(paise: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

function formatDate(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function periodLabel(plan: Pick<StudentPlan, 'id' | 'periodDays'>) {
  if (plan.id === 'monthly') return 'per month';
  if (plan.id === 'quarterly') return 'per quarter';
  if (plan.id === 'yearly') return 'per year';
  return `${plan.periodDays} days`;
}

function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load the payment window'));
    document.body.appendChild(script);
  });
}

export function SubscribePage() {
  const { user, refreshSession } = useAuth();
  const [payingId, setPayingId] = useState<PlanId | null>(null);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['billing-status', user?.id],
    queryFn: async () => {
      const { data: body } = await api.get<BillingStatus>('/billing/status');
      return body;
    },
    enabled: Boolean(user),
  });

  async function finish(accessUser: { access?: StudentAccess } | undefined) {
    await refreshSession();
    await refetch();
    if (accessUser?.access?.status === 'active') toast.success('Subscription active');
  }

  async function pay(planId: PlanId) {
    if (!data || payingId) return;
    setPayingId(planId);
    try {
      const { data: checkout } = await api.post<CheckoutResponse>('/billing/checkout', { planId });
      if (checkout.mode === 'dev') {
        const { data: activated } = await api.post<{ user: { access?: StudentAccess } }>('/billing/dev-activate', {
          paymentId: checkout.paymentId,
        });
        await finish(activated.user);
        return;
      }

      await loadRazorpay();
      if (!window.Razorpay || !checkout.keyId) {
        toast.error('Payment window is unavailable');
        return;
      }

      const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'Student';
      await new Promise<void>((resolve, reject) => {
        const rz = new window.Razorpay!({
          key: checkout.keyId,
          amount: checkout.amountPaise,
          currency: checkout.currency,
          name: 'ClassTrio',
          description: `${checkout.plan.label} student access`,
          order_id: checkout.orderId,
          prefill: { name, email: user?.email || '' },
          theme: { color: '#0f766e' },
          handler: async (response: RazorpaySuccess) => {
            try {
              const { data: verified } = await api.post<{ user: { access?: StudentAccess } }>('/billing/verify', {
                paymentId: checkout.paymentId,
                ...response,
              });
              await finish(verified.user);
              resolve();
            } catch (err) {
              reject(err);
            }
          },
          modal: {
            ondismiss: () => resolve(),
          },
        });
        rz.open();
      });
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        (err instanceof Error ? err.message : 'Payment failed');
      toast.error(message);
    } finally {
      setPayingId(null);
    }
  }

  if (isLoading || !data) return <FullPageSpinner />;

  const { access, checkout, plans, trialDays } = data;
  const isStudent = user?.hierarchyRole === 'user';
  const paid = access.status === 'active';

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
        Subscription
      </h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Students get {trialDays} days free, then choose a plan.
      </p>

      {isStudent ? (
        <p className="mt-4 text-sm text-slate-700 dark:text-slate-300">
          {paid ? (
            <>
              <span className="font-medium text-emerald-700 dark:text-emerald-300">Subscription active</span>
              {' through '}
              {formatDate(access.subscriptionEndsAt)}
              {access.daysLeft != null ? ` · ${access.daysLeft} day${access.daysLeft === 1 ? '' : 's'} left` : ''}.
              Another plan is added after this date.
            </>
          ) : access.status === 'expired' ? (
            'Your free trial has ended. Choose a plan to continue.'
          ) : access.status === 'pending' ? (
            'Your free trial starts when you sign in.'
          ) : (
            <>
              <span className="font-medium">
                {access.daysLeft ?? trialDays} day{(access.daysLeft ?? trialDays) === 1 ? '' : 's'} left
              </span>{' '}
              in your free trial
              {access.trialEndsAt ? ` · ends ${formatDate(access.trialEndsAt)}` : ''}. Paying now keeps those days,
              then adds the plan you choose.
            </>
          )}
        </p>
      ) : (
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
          Teachers and administrators are not billed. These plans are for student accounts.
        </p>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {plans.map((plan) => {
          const featured = plan.id === 'yearly';
          return (
            <article
              key={plan.id}
              className={clsx(
                'flex flex-col rounded-2xl border bg-white p-6 shadow-card dark:bg-slate-900/80',
                featured
                  ? 'border-brand-500 ring-1 ring-brand-500 dark:border-brand-400 dark:ring-brand-400'
                  : 'border-slate-200/80 dark:border-slate-700/80'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{plan.label}</h2>
                {featured ? (
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-800 dark:bg-brand-500/15 dark:text-brand-200">
                    Best value
                  </span>
                ) : null}
              </div>
              <p className="mt-4 font-display text-4xl font-semibold tracking-tight text-slate-900 dark:text-white">
                {formatInr(plan.amountPaise)}
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{periodLabel(plan)}</p>
              {isStudent && checkout !== 'unconfigured' ? (
                <Button
                  className="mt-6 w-full"
                  variant={featured ? 'primary' : 'secondary'}
                  disabled={payingId !== null}
                  onClick={() => void pay(plan.id)}
                >
                  {payingId === plan.id
                    ? 'Opening checkout…'
                    : checkout === 'dev'
                      ? 'Activate test plan'
                      : 'Choose plan'}
                </Button>
              ) : null}
            </article>
          );
        })}
      </div>

      {isStudent && checkout === 'unconfigured' ? (
        <p className="mt-4 text-sm text-rose-600 dark:text-rose-300">Payments are not configured on this server yet.</p>
      ) : null}
      {isStudent && checkout === 'dev' ? (
        <p className="mt-4 text-xs text-slate-500">
          Razorpay keys are not set, so this environment activates the plan without a charge.
        </p>
      ) : null}
    </div>
  );
}
