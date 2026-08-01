import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Badge, Button, Card, CardStat, FormField, Input } from '@/components/ui';
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
          <FormField label="Email" htmlFor="profile-email" required>
            <Input
              id="profile-email"
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </FormField>
          <div className="grid sm:grid-cols-2 gap-3">
            <FormField label="First name" htmlFor="profile-first">
              <Input
                id="profile-first"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </FormField>
            <FormField label="Last name" htmlFor="profile-last">
              <Input
                id="profile-last"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </FormField>
          </div>
          <FormField
            label="New password (optional)"
            htmlFor="profile-password"
            hint="Minimum 8 characters when changing password."
          >
            <Input
              id="profile-password"
              type="password"
              placeholder="Leave blank to keep current password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </FormField>
          <Button type="submit" disabled={updateUser.isPending}>
            {updateUser.isPending ? 'Saving…' : 'Save profile'}
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold mb-2 text-slate-900 dark:text-white">Effective permissions</h2>
        <div className="flex flex-wrap gap-2">
          {user.permissions.map((p) => (
            <Badge key={p}>{p}</Badge>
          ))}
        </div>
      </Card>
    </div>
  );
}
