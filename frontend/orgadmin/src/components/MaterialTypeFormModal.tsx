import { useState, useCallback } from 'preact/hooks';
import type { MaterialType, CreateMaterialTypeInput, UpdateMaterialTypeInput } from '@/types/material';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

interface MaterialTypeFormModalProps {
  materialType: MaterialType | null;
  onSubmit: (input: CreateMaterialTypeInput | UpdateMaterialTypeInput, imageFile?: File) => Promise<void>;
  onClose: () => void;
}

function getFullImageUrl(imageUrl: string | undefined): string | null {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http')) return imageUrl;
  return `${API_BASE}${imageUrl}`;
}

export function MaterialTypeFormModal({ materialType, onSubmit, onClose }: MaterialTypeFormModalProps) {
  const isEditing = !!materialType;
  const [name, setName] = useState(materialType?.name || '');
  const [description, setDescription] = useState(materialType?.description || '');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(getFullImageUrl(materialType?.imageUrl) || null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const handleImageChange = (file: File | null) => {
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setImageFile(null);
      setImagePreview(null);
    }
  };

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer?.files[0];
    if (file && file.type.startsWith('image/')) {
      handleImageChange(file);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const input = { name, description };
      await onSubmit(input, imageFile || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-bold text-secondary mb-4">
            {isEditing ? 'Materialtyp bearbeiten' : 'Materialtyp erstellen'}
          </h2>

          {error && (
            <div className="mb-4 bg-red-50 text-red-700 p-3 rounded text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName((e.target as HTMLInputElement).value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="z.B. AED Trainer"
              />
              <p className="text-xs text-text-secondary mt-1">
                ID wird aus dem Namen generiert: {name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Beschreibung
              </label>
              <textarea
                required
                value={description}
                onChange={(e) => setDescription((e.target as HTMLTextAreaElement).value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Geben Sie eine detaillierte Beschreibung ein..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Bild
              </label>
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  isDragging 
                    ? 'border-primary bg-primary bg-opacity-5' 
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                {imagePreview ? (
                  <div className="relative inline-block">
                    <img
                      src={imagePreview}
                      alt="Vorschau"
                      className="h-32 w-32 object-cover rounded"
                    />
                    <button
                      type="button"
                      onClick={() => handleImageChange(null)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-text-secondary mb-2">
                      Bild hierher ziehen oder zum Auswählen klicken
                    </p>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageChange((e.target as HTMLInputElement).files?.[0] || null)}
                      className="hidden"
                      id="image-input"
                    />
                    <label
                      htmlFor="image-input"
                      className="inline-block px-4 py-2 bg-gray-100 text-text-primary rounded hover:bg-gray-200 cursor-pointer transition-colors"
                    >
                      Datei auswählen
                    </label>
                  </>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-primary text-white font-medium rounded hover:bg-primary-hover transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Wird gespeichert...' : isEditing ? 'Aktualisieren' : 'Erstellen'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
