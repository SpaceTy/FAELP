import { useState, useEffect } from 'preact/hooks';
import type { DistributionCenter, CreateDistributionCenterInput, UpdateDistributionCenterInput } from '@/types/distributionCenter';
import { distributionCenterService } from '@/services/distributionCenters';
import { DistributionCenterFormModal } from '@/components/DistributionCenterFormModal';
import { DeleteConfirmationModal } from '@/components/DeleteConfirmationModal';

export function DistributionCentersPage() {
  const [centers, setCenters] = useState<DistributionCenter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingCenter, setEditingCenter] = useState<DistributionCenter | null>(null);
  const [deletingCenter, setDeletingCenter] = useState<DistributionCenter | null>(null);

  useEffect(() => {
    loadCenters();
  }, []);

  const loadCenters = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await distributionCenterService.listDistributionCenters();
      setCenters(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Vertriebszentren');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async (input: CreateDistributionCenterInput) => {
    try {
      await distributionCenterService.createDistributionCenter(input);
      await loadCenters();
      setIsFormModalOpen(false);
    } catch (err) {
      throw err;
    }
  };

  const handleUpdate = async (id: string, input: UpdateDistributionCenterInput) => {
    try {
      await distributionCenterService.updateDistributionCenter(id, input);
      await loadCenters();
      setEditingCenter(null);
    } catch (err) {
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!deletingCenter) return;
    try {
      await distributionCenterService.deleteDistributionCenter(deletingCenter.id);
      await loadCenters();
      setDeletingCenter(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Löschen des Vertriebszentrums');
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-text-primary">Vertriebszentren</h1>
          <button
            onClick={() => setIsFormModalOpen(true)}
            className="px-4 py-2 bg-primary text-white font-medium rounded hover:bg-primary-hover transition-colors"
          >
            Neues Vertriebszentrum
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 text-red-700 p-4 rounded">
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
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Adresse
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Socket-Pfad
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Aktionen
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {centers?.map((center) => (
                  <tr key={center.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-text-primary">{center.name}</div>
                      <div className="text-xs text-text-secondary">ID: {center.id}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-text-primary">{center.address}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-text-secondary">
                        {center.socketPath ? (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                            Lokal verbunden
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
                            Remote
                          </span>
                        )}
                      </div>
                      {center.socketPath && (
                        <div className="text-xs text-text-secondary mt-1">{center.socketPath}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => setEditingCenter(center)}
                        className="text-primary hover:text-primary-hover mr-4"
                      >
                        Bearbeiten
                      </button>
                      <button
                        onClick={() => setDeletingCenter(center)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Löschen
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {(!centers || centers.length === 0) && (
              <div className="text-center py-12 text-text-secondary">
                Keine Vertriebszentren gefunden. Klicken Sie auf "Neues Vertriebszentrum", um eines zu erstellen.
              </div>
            )}
          </div>
        )}
      </div>

      {(isFormModalOpen || editingCenter) && (
        <DistributionCenterFormModal
          center={editingCenter}
          onSubmit={editingCenter 
            ? (input) => handleUpdate(editingCenter.id, input)
            : handleCreate
          }
          onClose={() => {
            setIsFormModalOpen(false);
            setEditingCenter(null);
          }}
        />
      )}

      {deletingCenter && (
        <DeleteConfirmationModal
          title="Vertriebszentrum löschen"
          message={`Sind Sie sicher, dass Sie "${deletingCenter.name}" löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.`}
          onConfirm={handleDelete}
          onCancel={() => setDeletingCenter(null)}
        />
      )}
    </div>
  );
}
