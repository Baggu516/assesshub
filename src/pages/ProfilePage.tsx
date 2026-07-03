import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Card, CardStat } from '@/components/ui/Card';
import { useAuth } from '@/context/AuthContext';
import { useUserMutations } from '@/hooks/api/useUsers';

export function ProfilePage() {
  const { user, refreshSession } = useAuth();
  const { updateUser } = useUserMutations();

  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    if (user) {
      setEmail(user.email);
      setFirstName(user.firstName ?? '');
      setLastName(user.lastName ?? '');
      setNewPassword('');
    }
  }, [user]);

  if (!user) return null;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.trim() && newPassword.trim().length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    try {
      const body: Record<string, unknown> = {
        email: email.trim(),
        firstName,
        lastName,
      };
      if (newPassword.trim()) body.password = newPassword.trim();
      await updateUser.mutateAsync({ id: user.id, body });
      await refreshSession();
      setNewPassword('');
      toast.success('Profile updated');
    } catch {
      toast.error('Could not update profile');
    }
  };

  return (
    <div className="space-y-8 w-full">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Profile</h1>
        <p className="text-sm text-slate-500 mt-1">Your identity in this workspace. Changes apply after you save.</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <CardStat label="Hierarchy" value={user.hierarchyRole} />
        <CardStat label="Permission count" value={user.permissions.length} />
      </div>

      <Card>
        <h2 className="text-sm font-semibold mb-4 text-slate-900 dark:text-white">Edit profile</h2>
        <form onSubmit={onSubmit} className="space-y-4 max-w-xl">
          <div>
            <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-400">Email</label>
            <input
              required
              type="email"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-400">First name</label>
              <input
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-400">Last name</label>
              <input
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-400">
              New password (optional)
            </label>
            <input
              type="password"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
              placeholder="Leave blank to keep current password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
            <p className="text-xs text-slate-500 mt-1">Minimum 8 characters when changing password.</p>
          </div>
          <button
            type="submit"
            disabled={updateUser.isPending}
            className="rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {updateUser.isPending ? 'Saving…' : 'Save profile'}
          </button>
        </form>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold mb-2">Effective permissions</h2>
        <div className="flex flex-wrap gap-2">
          {user.permissions.map((p) => (
            <span
              key={p}
              className="text-xs rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-1 text-slate-700 dark:text-slate-200"
            >
              {p}
            </span>
          ))}
        </div>
      </Card>
    </div>
  );
}
