import { useState, useEffect, useMemo } from 'preact/hooks';
import { Modal } from './Modal';
import type { User } from '@/types/auth';

interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { username: string; password: string; isAdmin: boolean }) => Promise<void>;
  user?: User | null;
}

export function UserFormModal({ isOpen, onClose, onSubmit, user }: UserFormModalProps) {
  const isEditing = !!user;

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (user) {
        setUsername(user.username);
        setIsAdmin(user.isAdmin);
      } else {
        setUsername('');
        setIsAdmin(false);
      }
      setPassword('');
      setConfirmPassword('');
      setError(null);
    }
  }, [isOpen, user]);

  const passwordError = useMemo(() => {
    if (!password && !confirmPassword) return null;
    if (password !== confirmPassword) {
      return 'Passwörter stimmen nicht überein';
    }
    if (password.length < 8) {
      return 'Das Passwort muss mindestens 8 Zeichen lang sein';
    }
    return null;
  }, [password, confirmPassword]);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError(null);

    if (!isEditing && passwordError) {
      setError(passwordError);
      return;
    }

    if (!isEditing && !password) {
      setError('Ein Passwort ist erforderlich');
      return;
    }

    setIsLoading(true);

    try {
      await onSubmit({
        username: username.trim(),
        password,
        isAdmin,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten');
    } finally {
      setIsLoading(false);
    }
  };

  const canSubmit = isEditing
    ? username.trim().length >= 3
    : username.trim().length >= 3 && password && !passwordError;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Benutzer bearbeiten' : 'Neuen Benutzer erstellen'}
      maxWidth="md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="btn-logistics btn-logistics-outline"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            form="user-form"
            disabled={isLoading || !canSubmit}
            className="btn-logistics btn-logistics-primary"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Wird gespeichert...
              </>
            ) : (
              isEditing ? 'Speichern' : 'Erstellen'
            )}
          </button>
        </>
      }
    >
      <form id="user-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
            {error}
          </div>
        )}

        {/* Username */}
        <div>
          <label className="logistics-label" htmlFor="username">
            Benutzername *
          </label>
          <input
            type="text"
            id="username"
            value={username}
            onInput={(e) => setUsername((e.target as HTMLInputElement).value)}
            disabled={isEditing}
            className="logistics-input disabled:bg-gray-100 disabled:text-gray-500"
            placeholder="Mindestens 3 Zeichen"
            required
            minLength={3}
            autoComplete="off"
          />
          {isEditing && (
            <p className="mt-1 text-xs text-gray-500">
              Der Benutzername kann nicht geändert werden
            </p>
          )}
        </div>

        {/* Password */}
        {!isEditing && (
          <>
            <div>
              <label className="logistics-label" htmlFor="password">
                Passwort *
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
                className="logistics-input"
                placeholder="Mindestens 8 Zeichen"
                required={!isEditing}
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className="logistics-label" htmlFor="confirmPassword">
                Passwort bestätigen *
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onInput={(e) => setConfirmPassword((e.target as HTMLInputElement).value)}
                className={`logistics-input ${passwordError ? 'border-red-300 focus:border-red-500' : ''}`}
                placeholder="Passwort wiederholen"
                required={!isEditing}
                autoComplete="new-password"
              />
              {passwordError && (
                <p className="mt-1 text-xs text-red-600">{passwordError}</p>
              )}
            </div>
          </>
        )}

        {/* Admin Toggle */}
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded">
          <input
            type="checkbox"
            id="isAdmin"
            checked={isAdmin}
            onChange={(e) => setIsAdmin((e.target as HTMLInputElement).checked)}
            className="w-4 h-4 accent-logistics-accent cursor-pointer"
          />
          <label htmlFor="isAdmin" className="text-sm text-gray-700 cursor-pointer flex-1">
            <span className="font-medium">Administratorrechte</span>
            <p className="text-xs text-gray-500 mt-0.5">
              Admins können Benutzer verwalten und alle Operationen ausführen
            </p>
          </label>
        </div>
      </form>
    </Modal>
  );
}
