import { useEffect, useMemo, useState } from 'preact/hooks';
import { useI18n, type Locale } from '@/i18n';
import { userService } from '@/services/users';
import type { UserImportResult, UserRecord } from '@/types/user';

function formatDate(dateString: string, locale: Locale) {
  return new Date(dateString).toLocaleDateString(locale === 'de' ? 'de-DE' : 'en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function buildImportMessage(
  result: UserImportResult,
  t: (key: string, params?: Record<string, string | number>) => string
) {
  const parts = [
    t('users.import.result.created', { count: result.createdCount }),
    t('users.import.result.verified', { count: result.verifiedCount }),
    t('users.import.result.alreadyVerified', { count: result.alreadyVerifiedCount }),
  ];

  if (result.invalidEmails.length > 0) {
    parts.push(t('users.import.result.invalid', { count: result.invalidEmails.length }));
  }

  return parts.join(' | ');
}

export function UsersPage() {
  const { locale, t } = useI18n();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [importText, setImportText] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [mutatingUserId, setMutatingUserId] = useState<string | null>(null);

  const loadUsers = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await userService.listUsers();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('users.loadError'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleVerify = async (userId: string) => {
    setMutatingUserId(userId);
    setError('');
    setSuccess('');
    try {
      const updatedUser = await userService.verifyUser(userId);
      setUsers((prev) => prev.map((user) => (user.id === userId ? updatedUser : user)));
      setSuccess(t('users.verifySuccess', { email: updatedUser.email }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('users.verifyError'));
    } finally {
      setMutatingUserId(null);
    }
  };

  const handleUnverify = async (userId: string) => {
    setMutatingUserId(userId);
    setError('');
    setSuccess('');
    try {
      const updatedUser = await userService.unverifyUser(userId);
      setUsers((prev) => prev.map((user) => (user.id === userId ? updatedUser : user)));
      setSuccess(t('users.unverifySuccess', { email: updatedUser.email }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('users.unverifyError'));
    } finally {
      setMutatingUserId(null);
    }
  };

  const handleImport = async (e: Event) => {
    e.preventDefault();
    if (!importFile && importText.trim() === '') {
      setError(t('users.importRequired'));
      return;
    }

    setIsImporting(true);
    setError('');
    setSuccess('');
    try {
      const result = await userService.importUsers({ emailsText: importText, file: importFile });
      setSuccess(buildImportMessage(result, t));
      if (result.invalidEmails.length > 0) {
        setError(t('users.invalidSkipped', { emails: result.invalidEmails.join(', ') }));
      }
      setImportText('');
      setImportFile(null);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('users.importFailed'));
    } finally {
      setIsImporting(false);
    }
  };

  const summary = useMemo(() => {
    const verified = users.filter((user) => user.emailVerified).length;
    const admins = users.filter((user) => user.isAdmin).length;
    return {
      total: users.length,
      verified,
      unverified: users.length - verified,
      admins,
    };
  }, [users]);

  return (
    <div className="flex-1 overflow-auto bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">{t('users.title')}</h1>
            <p className="text-sm text-text-secondary mt-1">
              {t('users.subtitle')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="text-sm text-text-secondary">{t('users.summary.total')}</div>
            <div className="text-2xl font-semibold text-text-primary mt-1">{summary.total}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="text-sm text-text-secondary">{t('users.summary.verified')}</div>
            <div className="text-2xl font-semibold text-emerald-600 mt-1">{summary.verified}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="text-sm text-text-secondary">{t('users.summary.unverified')}</div>
            <div className="text-2xl font-semibold text-amber-600 mt-1">{summary.unverified}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="text-sm text-text-secondary">{t('users.summary.admins')}</div>
            <div className="text-2xl font-semibold text-text-primary mt-1">{summary.admins}</div>
          </div>
        </div>

        <form onSubmit={handleImport} className="bg-white rounded-lg shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">{t('users.import.title')}</h2>
              <p className="text-sm text-text-secondary mt-1">
                {t('users.import.description')}
              </p>
            </div>
            <button
              type="submit"
              disabled={isImporting}
              className="px-4 py-2 bg-primary text-white font-medium rounded hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
              {isImporting ? t('users.import.submitting') : t('users.import.submit')}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                {t('users.import.textareaLabel')}
              </label>
              <textarea
                value={importText}
                onInput={(e) => setImportText((e.currentTarget as HTMLTextAreaElement).value)}
                rows={8}
                placeholder={'schule1@example.de\nschule2@example.de'}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                {t('users.import.fileLabel')}
              </label>
              <label className="flex min-h-[176px] cursor-pointer items-center justify-center rounded border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-text-secondary hover:border-primary hover:text-text-primary">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => setImportFile((e.currentTarget as HTMLInputElement).files?.[0] || null)}
                />
                {importFile
                  ? t('users.import.fileSelected', { name: importFile.name })
                  : t('users.import.fileEmpty')}
              </label>
            </div>
          </div>
        </form>

        {success && (
          <div className="bg-emerald-50 text-emerald-700 p-4 rounded">
            {success}
          </div>
        )}

        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
            <p className="mt-2 text-text-secondary">{t('common.loading')}</p>
          </div>
        ) : (
          <div className="bg-white shadow overflow-hidden rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    {t('users.table.user')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    {t('users.table.status')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    {t('users.table.role')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    {t('users.table.workos')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    {t('users.table.created')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                    {t('users.table.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-text-primary">{user.name}</div>
                      <div className="text-sm text-text-secondary">{user.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.emailVerified ? (
                        <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">
                          {t('users.table.verified')}
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                          {t('users.table.unverified')}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.isAdmin ? (
                        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                          {t('users.table.admin')}
                        </span>
                      ) : (
                        <span className="text-sm text-text-secondary">{t('users.table.userRole')}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-text-secondary">
                        {user.workosUserId ? t('users.table.connected') : t('users.table.notRegistered')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
                      {formatDate(user.createdAt, locale)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {user.emailVerified ? (
                        <button
                          onClick={() => handleUnverify(user.id)}
                          disabled={mutatingUserId === user.id}
                          className="text-amber-600 hover:text-amber-700 disabled:text-gray-400"
                        >
                          {mutatingUserId === user.id ? t('users.table.updating') : t('users.table.unverify')}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleVerify(user.id)}
                          disabled={mutatingUserId === user.id}
                          className="text-primary hover:text-primary-hover disabled:text-gray-400"
                        >
                          {mutatingUserId === user.id ? t('users.table.updating') : t('users.table.verify')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {users.length === 0 && (
              <div className="text-center py-12 text-text-secondary">
                {t('users.table.empty')}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
