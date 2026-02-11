import { useState, useEffect, useCallback } from 'preact/hooks';
import { api } from '@/services/auth';
import type { User } from '@/types/auth';
import { UserFormModal } from '@/components/UserFormModal';
import { ConfirmModal } from '@/components/ConfirmModal';
import { Modal } from '@/components/Modal';

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AccountsPage() {
  // State
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [resettingUser, setResettingUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');

  // Load users
  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.listUsers();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Benutzer');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Actions
  const handleCreateUser = async (data: { username: string; password: string; isAdmin: boolean }) => {
    await api.createUser(data);
    setSuccess(`Benutzer "${data.username}" wurde erstellt`);
    setTimeout(() => setSuccess(null), 3000);
    await loadUsers();
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    await api.deleteUser(deletingUser.id);
    setIsDeleteModalOpen(false);
    setDeletingUser(null);
    setSuccess(`Benutzer "${deletingUser.username}" wurde gelöscht`);
    setTimeout(() => setSuccess(null), 3000);
    await loadUsers();
  };

  const handleToggleAdmin = async (user: User) => {
    await api.setUserAdmin(user.id, { isAdmin: !user.isAdmin });
    setSuccess(`Admin-Status für "${user.username}" wurde ${!user.isAdmin ? 'aktiviert' : 'deaktiviert'}`);
    setTimeout(() => setSuccess(null), 3000);
    await loadUsers();
  };

  const handleResetPassword = async () => {
    if (!resettingUser || !newPassword) return;
    if (newPassword.length < 8) {
      setError('Das Passwort muss mindestens 8 Zeichen lang sein');
      return;
    }
    await api.resetUserPassword(resettingUser.id, { newPassword });
    setIsResetPasswordModalOpen(false);
    setResettingUser(null);
    setNewPassword('');
    setSuccess(`Passwort für "${resettingUser.username}" wurde zurückgesetzt`);
    setTimeout(() => setSuccess(null), 3000);
  };

  // Open modals
  const openCreateModal = () => {
    setEditingUser(null);
    setIsFormModalOpen(true);
  };

  const openDeleteModal = (user: User) => {
    setDeletingUser(user);
    setIsDeleteModalOpen(true);
  };

  const openResetPasswordModal = (user: User) => {
    setResettingUser(user);
    setNewPassword('');
    setIsResetPasswordModalOpen(true);
  };

  return (
    <div className="h-full flex overflow-hidden bg-[#f0f2f5]">
      {/* Sidebar */}
      <aside className="w-64 bg-white p-4 overflow-y-auto border-r border-gray-200 flex-shrink-0">
        <div className="mb-6">
          <button
            onClick={openCreateModal}
            className="w-full btn-logistics btn-logistics-primary"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Neuer Benutzer
          </button>
        </div>

        {/* Stats */}
        <div className="stats-card">
          <h3>Übersicht</h3>
          <div className="stat-row">
            <span>Gesamt Benutzer</span>
            <span className="stat-value">{users.length}</span>
          </div>
          <div className="stat-row">
            <span>Admins</span>
            <span className="stat-value text-logistics-accent">
              {users.filter((u) => u.isAdmin).length}
            </span>
          </div>
          <div className="stat-row">
            <span>Normale Benutzer</span>
            <span className="stat-value">
              {users.filter((u) => !u.isAdmin).length}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Benutzerverwaltung</h1>
          <p className="text-gray-600 mt-1">
            Verwalten Sie Benutzeraccounts für das Distribution-Backend.
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {success}
            </div>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-logistics-accent border-t-transparent"></div>
            <span className="ml-3 text-gray-600">Wird geladen...</span>
          </div>
        )}

        {/* Users Table */}
        {!isLoading && (
          <div className="logistics-card overflow-hidden">
            {users.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <p className="text-gray-500">Keine Benutzer gefunden</p>
                <button
                  onClick={openCreateModal}
                  className="mt-4 text-logistics-accent hover:underline"
                >
                  Ersten Benutzer erstellen
                </button>
              </div>
            ) : (
              <table className="logistics-table">
                <thead>
                  <tr>
                    <th>Benutzername</th>
                    <th>Admin</th>
                    <th>Erstellt am</th>
                    <th className="text-right">Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-medium">
                            {user.username.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium">{user.username}</span>
                        </div>
                      </td>
                      <td>
                        <button
                          onClick={() => handleToggleAdmin(user)}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                            user.isAdmin
                              ? 'bg-logistics-accent text-white'
                              : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                          }`}
                        >
                          {user.isAdmin ? 'Admin' : 'User'}
                        </button>
                      </td>
                      <td className="text-gray-600">{formatDate(user.createdAt)}</td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openResetPasswordModal(user)}
                            className="btn-logistics btn-logistics-outline text-xs py-1.5 px-3"
                            title="Passwort zurücksetzen"
                          >
                            Passwort
                          </button>
                          <button
                            onClick={() => openDeleteModal(user)}
                            className="btn-logistics btn-logistics-danger text-xs py-1.5 px-3"
                            title="Benutzer löschen"
                          >
                            Löschen
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </main>

      {/* Form Modal */}
      <UserFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSubmit={handleCreateUser}
        user={editingUser}
      />

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteUser}
        title="Benutzer löschen"
        message={`Möchten Sie den Benutzer "${deletingUser?.username}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`}
        confirmText="Löschen"
        variant="danger"
      />

      {/* Reset Password Modal */}
      <Modal
        isOpen={isResetPasswordModalOpen}
        onClose={() => setIsResetPasswordModalOpen(false)}
        title="Passwort zurücksetzen"
        maxWidth="sm"
        footer={
          <>
            <button
              onClick={() => setIsResetPasswordModalOpen(false)}
              className="btn-logistics btn-logistics-outline"
            >
              Abbrechen
            </button>
            <button
              onClick={handleResetPassword}
              disabled={!newPassword || newPassword.length < 8}
              className="btn-logistics btn-logistics-primary"
            >
              Zurücksetzen
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Setzen Sie ein neues Passwort für <strong>{resettingUser?.username}</strong>.
          </p>
          <div>
            <label className="logistics-label" htmlFor="newPassword">
              Neues Passwort *
            </label>
            <input
              type="password"
              id="newPassword"
              value={newPassword}
              onInput={(e) => setNewPassword((e.target as HTMLInputElement).value)}
              className="logistics-input"
              placeholder="Mindestens 8 Zeichen"
              minLength={8}
              autoFocus
            />
            {newPassword && newPassword.length < 8 && (
              <p className="mt-1 text-xs text-red-600">
                Das Passwort muss mindestens 8 Zeichen lang sein
              </p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
