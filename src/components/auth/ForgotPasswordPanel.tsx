import { useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { Button, Input, PasswordInput } from '@/components/ui';

function errorMessage(err: unknown, fallback: string) {
  if (err && typeof err === 'object' && 'response' in err) {
    const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
    if (msg) return msg;
  }
  return fallback;
}

export function ForgotPasswordPanel({
  tenant,
  onBack,
}: {
  tenant: string;
  onBack: () => void;
}) {
  const [step, setStep] = useState<'ask' | 'code'>('ask');
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [hint, setHint] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const headers = { 'X-Tenant-Subdomain': tenant };

  async function sendCode(event?: FormEvent) {
    event?.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post<{ ok: boolean; hint?: string }>(
        '/auth/forgot-password',
        { identifier: identifier.trim() },
        { headers }
      );
      setHint(data.hint || '');
      setStep('code');
    } catch (err) {
      setError(errorMessage(err, 'Could not send a code'));
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Use at least 8 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await api.post(
        '/auth/reset-password',
        { identifier: identifier.trim(), otp: otp.trim(), password },
        { headers }
      );
      toast.success('Password updated. Sign in with the new one.');
      onBack();
    } catch (err) {
      setError(errorMessage(err, 'Could not reset the password'));
    } finally {
      setLoading(false);
    }
  }

  if (step === 'ask') {
    return (
      <form onSubmit={sendCode} className="mt-9 space-y-5">
        <div className="text-center">
          <h2 className="font-serif text-3xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-[2rem]">
            Forgot password
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            Enter the email or registration ID on the account. We will send a 6-digit code to that email.
          </p>
        </div>
        <div className="space-y-2">
          <label htmlFor="reset-id" className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Email or registration ID
          </label>
          <Input
            id="reset-id"
            type="text"
            inputMode="text"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="you@school.edu or xyz123"
            required
            autoComplete="username"
            className="rounded-xl border-brand-200/80 py-3 shadow-none focus:border-brand-500 dark:border-slate-600"
          />
        </div>
        {error ? <p className="text-center text-sm text-rose-600">{error}</p> : null}
        <Button type="submit" size="lg" className="w-full rounded-xl py-3.5 text-[15px] font-semibold" disabled={loading}>
          {loading ? 'Sending…' : 'Send code'}
        </Button>
        <button type="button" onClick={onBack} className="w-full text-sm font-semibold text-brand-700 dark:text-brand-300">
          Back to sign in
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={resetPassword} className="mt-9 space-y-5">
      <div className="text-center">
        <h2 className="font-serif text-3xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-[2rem]">
          Enter the code
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          {hint
            ? `We sent a code to ${hint}. It expires in 10 minutes.`
            : 'If that account has an email, we sent a code. It expires in 10 minutes.'}
        </p>
      </div>
      <div className="space-y-2">
        <label htmlFor="otp" className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          Email code
        </label>
        <Input
          id="otp"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="6-digit code"
          required
          className="rounded-xl border-brand-200/80 py-3 text-center tracking-[0.3em] shadow-none focus:border-brand-500 dark:border-slate-600"
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="new-password" className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          New password
        </label>
        <PasswordInput
          id="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
          className="[&_input]:rounded-xl [&_input]:border-brand-200/80 [&_input]:py-3 [&_input]:shadow-none [&_input]:focus:border-brand-500 dark:[&_input]:border-slate-600"
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="confirm-password" className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          Confirm password
        </label>
        <PasswordInput
          id="confirm-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          autoComplete="new-password"
          className="[&_input]:rounded-xl [&_input]:border-brand-200/80 [&_input]:py-3 [&_input]:shadow-none [&_input]:focus:border-brand-500 dark:[&_input]:border-slate-600"
        />
      </div>
      {error ? <p className="text-center text-sm text-rose-600">{error}</p> : null}
      <Button type="submit" size="lg" className="w-full rounded-xl py-3.5 text-[15px] font-semibold" disabled={loading}>
        {loading ? 'Saving…' : 'Reset password'}
      </Button>
      <div className="flex items-center justify-between text-sm">
        <button type="button" onClick={onBack} className="font-semibold text-brand-700 dark:text-brand-300">
          Back to sign in
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => sendCode()}
          className="font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
        >
          Resend code
        </button>
      </div>
    </form>
  );
}
