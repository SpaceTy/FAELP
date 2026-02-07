import { useEffect, useMemo, useState } from 'preact/hooks';
import { api } from '@/services/auth';
import type { User } from '@/types/auth';

function formatDate(input: string): string {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return input;
  }
  return parsed.toLocaleString('de-DE');
}

export function AccountsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const passwordError = useMemo(() => {
    if (!password || !confirmPassword) {
      return null;
    }
    if (password !== confirmPassword) {
      return 'Passwörter stimmen nicht überein.';
    }
    if (password.length < 8) {
      return 'Das Passwort muss mindestens 8 Zeichen lang sein.';
    }
    return null;
  }, [password, confirmPassword]);

  const loadUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const data = await api.listUsers();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Benutzerliste konnte nicht geladen werden.');
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const resetForm = () => {
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setIsAdmin(false);
  };

  const handleCreateAccount = async (e: Event) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (passwordError) {
      setError(passwordError);
      return;
    }

    setIsSubmitting(true);
    try {
      await api.createUser({
        username: username.trim(),
        password,
        isAdmin,
      });
      setSuccess(`Account "${username.trim()}" wurde erstellt.`);
      resetForm();
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Account konnte nicht erstellt werden.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="h-full overflow-auto bg-background">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-text-primary">Neuen Account erstellen</h2>
          <p className="text-sm text-text-secondary mt-1">
            Erstellt einen neuen Login für das Distribution-Backend unter <code>/api/users</code>.
          </p>

          {error && (
            <div className="mt-4 p-3 rounded border border-red-300 bg-red-50 text-red-700 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="mt-4 p-3 rounded border border-green-300 bg-green-50 text-green-700 text-sm">
              {success}
            </div>
          )}

          <form className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleCreateAccount}>
            <div className="md:col-span-2">
              <label htmlFor="username" className="block text-sm font-medium text-text-primary mb-1">
                Benutzername
              </label>
              <input
                id="username"
                type="text"
                required
                minLength={3}
                value={username}
                onInput={(e) => setUsername((e.target as HTMLInputElement).value)}
                placeholder="z. B. lager.team.nord"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-text-primary mb-1">
                Passwort
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-text-primary mb-1">
                Passwort bestätigen
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onInput={(e) => setConfirmPassword((e.target as HTMLInputElement).value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <div className="md:col-span-2">
              <label className="inline-flex items-center gap-2 text-sm text-text-primary">
                <input
                  type="checkbox"
                  checked={isAdmin}
                  onChange={(e) => setIsAdmin((e.target as HTMLInputElement).checked)}
                  className="rounded border-gray-300 text-primary focus:ring-primary"
                />
                Admin-Rechte vergeben
              </label>
            </div>

            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-primary hover:bg-primary-hover text-white font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Erstelle...' : 'Account erstellen'}
              </button>
            </div>
          </form>
        </section>

        <section className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-text-primary">Bestehende Accounts</h3>
            <button
              type="button"
              onClick={loadUsers}
              disabled={isLoadingUsers}
              className="px-3 py-1.5 text-sm bg-secondary text-white rounded hover:bg-secondary-hover transition-colors disabled:opacity-50"
            >
              {isLoadingUsers ? 'Aktualisiere...' : 'Neu laden'}
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-left text-sm text-text-secondary">
                  <th className="py-2 pr-4 font-medium">Benutzername</th>
                  <th className="py-2 pr-4 font-medium">Rolle</th>
                  <th className="py-2 pr-4 font-medium">Erstellt</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-gray-100 text-sm text-text-primary">
                    <td className="py-2 pr-4">{user.username}</td>
                    <td className="py-2 pr-4">{user.isAdmin ? 'Admin' : 'User'}</td>
                    <td className="py-2 pr-4">{formatDate(user.createdAt)}</td>
                  </tr>
                ))}
                {users.length === 0 && !isLoadingUsers && (
                  <tr>
                    <td className="py-6 text-center text-text-secondary" colSpan={3}>
                      Keine Accounts gefunden.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
