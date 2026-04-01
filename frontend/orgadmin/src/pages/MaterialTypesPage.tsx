import { useState, useEffect } from 'preact/hooks';
import { useI18n } from '@/i18n';
import { MATERIAL_CATEGORY_TRANSLATION_KEYS, type MaterialType, type CreateMaterialTypeInput, type UpdateMaterialTypeInput } from '@/types/material';
import { materialTypeService } from '@/services/materialTypes';
import { MaterialTypeFormModal } from '@/components/MaterialTypeFormModal';
import { DeleteConfirmationModal } from '@/components/DeleteConfirmationModal';
import { resolveAssetUrl } from '@/utils/url';

function getFullImageUrl(imageUrl: string | undefined): string | null {
  if (!imageUrl) return null;
  return resolveAssetUrl(imageUrl);
}

export function MaterialTypesPage() {
  const { t } = useI18n();
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
      setError(err instanceof Error ? err.message : t('materialTypes.loadError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async (input: CreateMaterialTypeInput, imageFile?: File) => {
    const newMaterialType = await materialTypeService.createMaterialType(input);
    await loadMaterialTypes();
    setIsFormModalOpen(false);
    if (imageFile) {
      try {
        await materialTypeService.uploadImage(newMaterialType.id, imageFile);
        await loadMaterialTypes();
      } catch (err) {
        setError(t('materialTypes.imageUploadFailed', {
          error: err instanceof Error ? err.message : t('materialTypeForm.unknownError')
        }));
      }
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
      setError(err instanceof Error ? err.message : t('materialTypes.deleteError'));
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-text-primary">{t('materialTypes.title')}</h1>
          <button
            onClick={() => setIsFormModalOpen(true)}
            className="px-4 py-2 bg-primary text-white font-medium rounded hover:bg-primary-hover transition-colors"
          >
            {t('materialTypes.new')}
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
            <p className="mt-2 text-text-secondary">{t('common.loading')}</p>
          </div>
        ) : (
          <div className="bg-white shadow overflow-hidden rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    {t('materialTypes.table.image')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    {t('materialTypes.table.name')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    {t('materialTypes.table.description')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    {t('materialTypes.table.category')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                    {t('materialTypes.table.actions')}
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
                          {t('materialTypes.table.noImage')}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-text-primary">{mt.name}</div>
                      <div className="text-xs text-text-secondary">{t('materialTypes.table.id', { id: mt.id })}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-text-primary line-clamp-2">{mt.description}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-text-primary">
                        {t(MATERIAL_CATEGORY_TRANSLATION_KEYS[mt.category])}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => setEditingMaterialType(mt)}
                        className="text-primary hover:text-primary-hover mr-4"
                      >
                        {t('common.edit')}
                      </button>
                      <button
                        onClick={() => setDeletingMaterialType(mt)}
                        className="text-red-600 hover:text-red-800"
                      >
                        {t('common.delete')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {(!materialTypes || materialTypes.length === 0) && (
              <div className="text-center py-12 text-text-secondary">
                {t('materialTypes.empty')}
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
          title={t('materialTypes.deleteTitle')}
          message={t('materialTypes.deleteMessage', { name: deletingMaterialType.name })}
          onConfirm={handleDelete}
          onCancel={() => setDeletingMaterialType(null)}
        />
      )}
    </div>
  );
}
