import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { useTenant } from '@/context/TenantContext';
import { Button, FormField, Input } from '@/components/ui';

const HIGHLIGHTS = [
  {
    title: 'Year-aware classes',
    body: 'Enrollments stay with each academic year — promotions keep history intact.',
  },
  {
    title: 'Quizzes that travel with the class',
    body: 'Teachers assign assessments; students see work for the year they’re in.',
  },
  {
    title: 'One hub for the whole school',
    body: 'Admins, teachers, and students share the same clear workflow.',
  },
];

export function LoginPage() {
  const { login } = useAuth();
  const { subdomain, setSubdomain } = useTenant();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      toast.error(msg || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      {/* Brand / product panel */}
      <aside className="relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-900 via-brand-800 to-teal-700 px-8 py-10 text-white sm:px-12 lg:min-h-screen lg:px-14 lg:py-14">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'radial-gradient(ellipse 70% 50% at 15% 20%, rgb(45 212 191 / 0.35), transparent 55%), radial-gradient(ellipse 50% 40% at 90% 80%, rgb(8 145 178 / 0.3), transparent 50%)',
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
          }}
          aria-hidden
        />

        {/* Soft floating shapes */}
        <div
          className="pointer-events-none absolute -right-16 top-24 h-56 w-56 rounded-full border border-white/10 animate-[fade-in_1.2s_ease-out_both]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-8 top-32 h-40 w-40 rounded-full bg-white/5 animate-[fade-in_1.4s_ease-out_both]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute bottom-20 left-10 h-24 w-24 rounded-2xl border border-teal-300/20 bg-teal-400/10 rotate-12 animate-[fade-up_0.8s_ease-out_0.2s_both]"
          aria-hidden
        />

        <div className="relative z-10 animate-fade-up">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur-sm">
              <span className="font-display text-lg font-bold tracking-tight">A</span>
            </div>
            <p className="font-display text-2xl font-bold tracking-tight sm:text-3xl">AssessHub</p>
          </div>

          <h1 className="mt-10 max-w-md font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:mt-16 lg:text-[2.65rem] lg:leading-[1.15]">
            Assessment platform for schools
          </h1>
          <p className="mt-4 max-w-sm text-base leading-relaxed text-teal-50/85 sm:text-lg">
            Run classes by academic year, promote students cleanly, and assign quizzes that stay
            tied to the right year.
          </p>
        </div>

        <ul className="relative z-10 mt-12 hidden space-y-6 lg:mt-0 lg:block">
          {HIGHLIGHTS.map((item, i) => (
            <li
              key={item.title}
              className="animate-fade-up max-w-md"
              style={{ animationDelay: `${0.15 + i * 0.08}s` }}
            >
              <p className="font-display text-sm font-semibold tracking-tight text-white">
                {item.title}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-teal-100/75">{item.body}</p>
            </li>
          ))}
        </ul>

        <p className="relative z-10 mt-10 text-xs text-teal-100/50 lg:mt-0">
          Built for teachers, students, and school admins.
        </p>
      </aside>

      {/* Sign-in panel */}
      <main className="relative flex flex-col justify-center bg-[rgb(var(--surface))] px-6 py-12 sm:px-10 lg:px-16 xl:px-24">
        <div className="pointer-events-none absolute inset-0 bg-mesh-light dark:bg-mesh-dark opacity-60" aria-hidden />

        <div className="relative z-10 mx-auto w-full max-w-md animate-fade-up">
          <div className="lg:hidden mb-8">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white font-display text-sm font-bold">
              A
            </div>
          </div>

          <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-[1.75rem]">
            Sign in
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Enter your school subdomain and account to continue.
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <FormField
              label="Organization subdomain"
              htmlFor="subdomain"
              required
              hint={`Matches your URL: ${subdomain || 'acme'}.assesshub.com`}
            >
              <Input
                id="subdomain"
                value={subdomain}
                onChange={(e) => setSubdomain(e.target.value)}
                placeholder="e.g. acme"
                required
              />
            </FormField>
            <FormField label="Email" htmlFor="email" required>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </FormField>
            <FormField label="Password" htmlFor="password" required>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </FormField>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-500">
            <Link
              className="font-medium text-brand-700 transition-colors hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
              to="/platform/login"
            >
              Platform admin
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
