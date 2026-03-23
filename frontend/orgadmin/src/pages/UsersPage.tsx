import { useEffect, useMemo, useState } from 'preact/hooks';
import { userService } from '@/services/users';
import type { UserImportResult, UserRecord } from '@/types/user';

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function buildImportMessage(result: UserImportResult) {
  const parts = [
    `${result.createdCount} neu angelegt`,
    `${result.verifiedCount} bestehend verifiziert`,
    `${result.alreadyVerifiedCount} bereits verifiziert`,
  ];

  if (result.invalidEmails.length > 0) {
    parts.push(`${result.invalidEmails.length} ungueltig`);
  }

  return parts.join(' | ');
}

export function UsersPage() {
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
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Benutzer');
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
      setSuccess(`Benutzer ${updatedUser.email} wurde verifiziert.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Benutzer konnte nicht verifiziert werden');
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
      setSuccess(`Benutzer ${updatedUser.email} wurde auf unverifiziert gesetzt.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Benutzer konnte nicht auf unverifiziert gesetzt werden');
    } finally {
      setMutatingUserId(null);
    }
  };

  const handleImport = async (e: Event) => {
    e.preventDefault();
    if (!importFile && importText.trim() === '') {
      setError('Bitte CSV-Datei auswaehlen oder E-Mails einfuegen.');
      return;
    }

    setIsImporting(true);
    setError('');
    setSuccess('');
    try {
      const result = await userService.importUsers({ emailsText: importText, file: importFile });
      setSuccess(buildImportMessage(result));
      if (result.invalidEmails.length > 0) {
        setError(`Ungueltige E-Mails uebersprungen: ${result.invalidEmails.join(', ')}`);
      }
      setImportText('');
      setImportFile(null);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import fehlgeschlagen');
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
            <h1 className="text-2xl font-bold text-text-primary">Benutzer</h1>
            <p className="text-sm text-text-secondary mt-1">
              Unverifizierte Konten pruefen und registrierte Schul-E-Mails gesammelt freischalten.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="text-sm text-text-secondary">Gesamt</div>
            <div className="text-2xl font-semibold text-text-primary mt-1">{summary.total}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="text-sm text-text-secondary">Verifiziert</div>
            <div className="text-2xl font-semibold text-emerald-600 mt-1">{summary.verified}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="text-sm text-text-secondary">Unverifiziert</div>
            <div className="text-2xl font-semibold text-amber-600 mt-1">{summary.unverified}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="text-sm text-text-secondary">Admins</div>
            <div className="text-2xl font-semibold text-text-primary mt-1">{summary.admins}</div>
          </div>
        </div>

        <form onSubmit={handleImport} className="bg-white rounded-lg shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Verifizierte E-Mails importieren</h2>
              <p className="text-sm text-text-secondary mt-1">
                CSV-Datei hochladen oder E-Mails zeilenweise einfuegen. Bereits angemeldete Benutzer werden direkt freigeschaltet.
              </p>
            </div>
            <button
              type="submit"
              disabled={isImporting}
              className="px-4 py-2 bg-primary text-white font-medium rounded hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
              {isImporting ? 'Import laeuft...' : 'Import starten'}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                E-Mails direkt einfuegen
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
                CSV-Datei
              </label>
              <label className="flex min-h-[176px] cursor-pointer items-center justify-center rounded border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-text-secondary hover:border-primary hover:text-text-primary">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => setImportFile((e.currentTarget as HTMLInputElement).files?.[0] || null)}
                />
                {importFile ? `${importFile.name} ausgewaehlt` : 'CSV-Datei auswaehlen'}
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
            <p className="mt-2 text-text-secondary">Wird geladen...</p>
          </div>
        ) : (
          <div className="bg-white shadow overflow-hidden rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Benutzer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Rolle
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    WorkOS
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Erstellt
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Aktionen
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
                          Verifiziert
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                          Unverifiziert
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.isAdmin ? (
                        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                          Admin
                        </span>
                      ) : (
                        <span className="text-sm text-text-secondary">Benutzer</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-text-secondary">
                        {user.workosUserId ? 'Verbunden' : 'Noch nicht registriert'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {user.emailVerified ? (
                        <button
                          onClick={() => handleUnverify(user.id)}
                          disabled={mutatingUserId === user.id}
                          className="text-amber-600 hover:text-amber-700 disabled:text-gray-400"
                        >
                          {mutatingUserId === user.id ? 'Aktualisiere...' : 'Unverify'}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleVerify(user.id)}
                          disabled={mutatingUserId === user.id}
                          className="text-primary hover:text-primary-hover disabled:text-gray-400"
                        >
                          {mutatingUserId === user.id ? 'Aktualisiere...' : 'Verifizieren'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {users.length === 0 && (
              <div className="text-center py-12 text-text-secondary">
                Keine Benutzer gefunden.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
