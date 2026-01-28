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
      setError(err instanceof Error ? err.message : 'Failed to load material types');
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
      setError(err instanceof Error ? err.message : 'Failed to delete material type');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-secondary">Material Types</h1>
          <button
            onClick={() => setIsFormModalOpen(true)}
            className="px-4 py-2 bg-primary text-secondary font-medium rounded hover:bg-primary-hover transition-colors"
          >
            Add New Material Type
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-4 bg-red-50 text-red-700 p-4 rounded">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
            <p className="mt-2 text-text-secondary">Loading...</p>
          </div>
        ) : (
          <div className="bg-white shadow overflow-hidden rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Image
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Actions
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
                        <div className="h-16 w-16 bg-gray-200 rounded flex items-center justify-center text-gray-400">
                          No image
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
                        Edit
                      </button>
                      <button
                        onClick={() => setDeletingMaterialType(mt)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {(!materialTypes || materialTypes.length === 0) && (
              <div className="text-center py-12 text-text-secondary">
                No material types found. Click "Add New Material Type" to create one.
              </div>
            )}
          </div>
        )}
      </main>

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
          title="Delete Material Type"
          message={`Are you sure you want to delete "${deletingMaterialType.name}"? This action cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setDeletingMaterialType(null)}
        />
      )}
    </div>
  );
}
