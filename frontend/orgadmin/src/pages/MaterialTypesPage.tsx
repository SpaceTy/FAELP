import { useState, useEffect } from 'preact/hooks';
import type { MaterialType, CreateMaterialTypeInput, UpdateMaterialTypeInput } from '@/types/material';
import { materialTypeService } from '@/services/materialTypes';
import { MaterialTypeFormModal } from '@/components/MaterialTypeFormModal';
import { DeleteConfirmationModal } from '@/components/DeleteConfirmationModal';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

function getFullImageUrl(imageUrl: string | undefined): string | null {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http')) return imageUrl;
  return `${API_BASE}${imageUrl}`;
}

export function MaterialTypesPage() {
  const [materialTypes, setMaterialTypes] = useState<MaterialType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingMaterialType, setEditingMaterialType] = useState<MaterialType | null>(null);
  const [deletingMaterialType, setDeletingMaterialType] = useState<MaterialType | null>(null);

  useEffect(() => {
    loadMaterialTypes();
  }, []);

  const loadMaterialTypes = async () => {
    setIsLoading(true);
    setError('');
    try {
      const types = await materialTypeService.listMaterialTypes();
      setMaterialTypes(types);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Materialtypen');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async (input: CreateMaterialTypeInput, imageFile?: File) => {
    try {
      const newMaterialType = await materialTypeService.createMaterialType(input);
      if (imageFile) {
        await materialTypeService.uploadImage(newMaterialType.id, imageFile);
      }
      await loadMaterialTypes();
      setIsFormModalOpen(false);
    } catch (err) {
      throw err;
    }
  };

  const handleUpdate = async (id: string, input: UpdateMaterialTypeInput, imageFile?: File) => {
    try {
      await materialTypeService.updateMaterialType(id, input);
      if (imageFile) {
        await materialTypeService.uploadImage(id, imageFile);
      }
      await loadMaterialTypes();
      setEditingMaterialType(null);
    } catch (err) {
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!deletingMaterialType) return;
    try {
      await materialTypeService.deleteMaterialType(deletingMaterialType.id);
      await loadMaterialTypes();
      setDeletingMaterialType(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Löschen des Materialtyps');
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-text-primary">Materialtypen</h1>
          <button
            onClick={() => setIsFormModalOpen(true)}
            className="px-4 py-2 bg-primary text-white font-medium rounded hover:bg-primary-hover transition-colors"
          >
            Neuer Materialtyp
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
                    Bild
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Beschreibung
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Aktionen
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {materialTypes?.map((mt) => (
                  <tr key={mt.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      {mt.imageUrl ? (
                        <img
                          src={getFullImageUrl(mt.imageUrl) || ''}
                          alt={mt.name}
                          className="h-16 w-16 object-cover rounded"
                        />
                      ) : (
                        <div className="h-16 w-16 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs">
                          Kein Bild
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-text-primary">{mt.name}</div>
                      <div className="text-xs text-text-secondary">ID: {mt.id}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-text-primary line-clamp-2">{mt.description}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => setEditingMaterialType(mt)}
                        className="text-primary hover:text-primary-hover mr-4"
                      >
                        Bearbeiten
                      </button>
                      <button
                        onClick={() => setDeletingMaterialType(mt)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Löschen
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {(!materialTypes || materialTypes.length === 0) && (
              <div className="text-center py-12 text-text-secondary">
                Keine Materialtypen gefunden. Klicken Sie auf "Neuer Materialtyp", um einen zu erstellen.
              </div>
            )}
          </div>
        )}
      </div>

      {(isFormModalOpen || editingMaterialType) && (
        <MaterialTypeFormModal
          materialType={editingMaterialType}
          onSubmit={editingMaterialType 
            ? (input, file) => handleUpdate(editingMaterialType.id, input, file)
            : handleCreate
          }
          onClose={() => {
            setIsFormModalOpen(false);
            setEditingMaterialType(null);
          }}
        />
      )}

      {deletingMaterialType && (
        <DeleteConfirmationModal
          title="Materialtyp löschen"
          message={`Sind Sie sicher, dass Sie "${deletingMaterialType.name}" löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.`}
          onConfirm={handleDelete}
          onCancel={() => setDeletingMaterialType(null)}
        />
      )}
    </div>
  );
}
