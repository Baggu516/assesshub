import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import {
  useTenantOrganization,
  useTenantOrganizationMutations,
  type TenantOrganization,
} from '@/hooks/api/useTenant';

export function SettingsPage() {
  const { data } = useTenantOrganization();
  const { applyTenantUpdate } = useTenantOrganizationMutations();

  const [navDashboard, setNavDashboard] = useState('');
  const [navAssessments, setNavAssessments] = useState('');
  const [navSubordinates, setNavSubordinates] = useState('');
  const [navClasses, setNavClasses] = useState('');
  const [navUsers, setNavUsers] = useState('');
  const [navUsersMember, setNavUsersMember] = useState('');
  const [navProfile, setNavProfile] = useState('');
  const [navOrganization, setNavOrganization] = useState('');
  const [navSettings, setNavSettings] = useState('');

  useEffect(() => {
    if (data) {
      const sl = data.settings?.sidebarLabels;
      setNavDashboard(sl?.dashboard ?? '');
      setNavAssessments(sl?.assessments ?? '');
      setNavSubordinates(sl?.subordinates ?? '');
      setNavClasses(sl?.classes ?? '');
      setNavUsers(sl?.users ?? '');
      setNavUsersMember(sl?.usersMember ?? '');
      setNavProfile(sl?.profile ?? '');
      setNavOrganization(sl?.organization ?? '');
      setNavSettings(sl?.settingsNav ?? '');
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: res } = await api.patch<{ organization: TenantOrganization }>('/tenant/settings', {
        settings: {
          sidebarLabels: {
            dashboard: navDashboard.trim(),
            assessments: navAssessments.trim(),
            subordinates: navSubordinates.trim(),
            classes: navClasses.trim(),
            users: navUsers.trim(),
            usersMember: navUsersMember.trim(),
            profile: navProfile.trim(),
            organization: navOrganization.trim(),
            settingsNav: navSettings.trim(),
          },
        },
      });
      return res.organization;
    },
    onSuccess: (organization) => {
      applyTenantUpdate(organization);
      toast.success('Saved');
    },
    onError: () => toast.error('Save failed'),
  });

  return (
    <div className="space-y-8 w-full">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Customize sidebar navigation labels for everyone in this organization (requires settings_manage). Organization
          name and timezone are under Organization.
        </p>
      </div>
      <Card>
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Sidebar labels</h2>
            <p className="text-xs text-slate-500">
              Optional names for navigation items. Leave blank to use the default. Applies to everyone in this organization.
            </p>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <label className="block">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Dashboard</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2"
                  placeholder="Dashboard"
                  value={navDashboard}
                  onChange={(e) => setNavDashboard(e.target.value)}
                  maxLength={48}
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Assessments</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2"
                  placeholder="Assessments"
                  value={navAssessments}
                  onChange={(e) => setNavAssessments(e.target.value)}
                  maxLength={48}
                />
              </label>
              <label className="block md:col-span-2">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Teachers</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2"
                  placeholder="Teachers"
                  value={navSubordinates}
                  onChange={(e) => setNavSubordinates(e.target.value)}
                  maxLength={48}
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Classes</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2"
                  placeholder="Classes"
                  value={navClasses}
                  onChange={(e) => setNavClasses(e.target.value)}
                  maxLength={48}
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Students (admin)</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2"
                  placeholder="Users"
                  value={navUsers}
                  onChange={(e) => setNavUsers(e.target.value)}
                  maxLength={48}
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Students (teacher)</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2"
                  placeholder="People"
                  value={navUsersMember}
                  onChange={(e) => setNavUsersMember(e.target.value)}
                  maxLength={48}
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Profile</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2"
                  placeholder="Profile"
                  value={navProfile}
                  onChange={(e) => setNavProfile(e.target.value)}
                  maxLength={48}
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Organization</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2"
                  placeholder="Organization"
                  value={navOrganization}
                  onChange={(e) => setNavOrganization(e.target.value)}
                  maxLength={48}
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Settings</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2"
                  placeholder="Settings"
                  value={navSettings}
                  onChange={(e) => setNavSettings(e.target.value)}
                  maxLength={48}
                />
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={save.isPending}
            className="rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-medium"
          >
            {save.isPending ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </Card>
    </div>
  );
}
