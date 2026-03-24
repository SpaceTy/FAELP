import { useState, useMemo } from 'preact/hooks';
import { MaterialCard } from '@/components/Material/MaterialCard';
import { useMaterialTypes } from '@/context/MaterialTypesContext';
import { CATEGORY_LABELS, type Material, type MaterialCategory } from '@/types/material';

type MaterialSortOption = 'relevance' | 'name-asc' | 'category';

function compareByName(a: Material, b: Material) {
  return a.name.localeCompare(b.name, 'de', { sensitivity: 'base' });
}

function compareByCategory(a: Material, b: Material) {
  const categoryComparison = CATEGORY_LABELS[a.category].localeCompare(
    CATEGORY_LABELS[b.category],
    'de',
    { sensitivity: 'base' }
  );

  if (categoryComparison !== 0) {
    return categoryComparison;
  }

  return compareByName(a, b);
}

function compareByAvailability(a: Material, b: Material) {
  return b.availableCount - a.availableCount;
}

function getRelevanceRank(material: Material, normalizedQuery: string) {
  if (normalizedQuery === '') {
    return Number.MAX_SAFE_INTEGER;
  }

  const name = material.name.toLowerCase();
  const description = material.description.toLowerCase();

  if (name === normalizedQuery) {
    return 0;
  }

  if (name.startsWith(normalizedQuery)) {
    return 1;
  }

  const nameIndex = name.indexOf(normalizedQuery);
  if (nameIndex >= 0) {
    return 10 + nameIndex;
  }

  if (description.startsWith(normalizedQuery)) {
    return 100;
  }

  const descriptionIndex = description.indexOf(normalizedQuery);
  if (descriptionIndex >= 0) {
    return 200 + descriptionIndex;
  }

  return Number.MAX_SAFE_INTEGER;
}

export function MaterialsPage() {
  const { materials, isLoading, error } = useMaterialTypes();
  const showCategorySidebar = false;
  const [selectedCategories, setSelectedCategories] = useState<MaterialCategory[]>([
    'Reanimation',
    'Wundversorgung&Trauma',
    'Zubehoer'
  ]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<MaterialSortOption>('relevance');

  const filteredMaterials = useMemo(() => {
    if (!materials) return [];
    return materials.filter(material => {
      const matchesCategory = selectedCategories.includes(material.category);
      const matchesSearch = searchQuery === '' || 
        material.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        material.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [materials, selectedCategories, searchQuery]);

  const sortedMaterials = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return [...filteredMaterials].sort((a, b) => {
      switch (sortOption) {
        case 'name-asc':
          return compareByName(a, b);
        case 'category':
          return compareByCategory(a, b);
        case 'relevance':
        default: {
          const relevanceDifference =
            getRelevanceRank(a, normalizedQuery) - getRelevanceRank(b, normalizedQuery);

          if (relevanceDifference !== 0) {
            return relevanceDifference;
          }

          const availabilityDifference = compareByAvailability(a, b);
          if (availabilityDifference !== 0) {
            return availabilityDifference;
          }

          return compareByName(a, b);
        }
      }
    });
  }, [filteredMaterials, searchQuery, sortOption]);

  const toggleCategory = (category: MaterialCategory) => {
    setSelectedCategories(prev => 
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  return (
    <main className="flex-1 flex overflow-hidden">
        {showCategorySidebar && (
          /* Sidebar Filters kept in place for future reuse */
          <aside className="w-64 bg-white p-6 overflow-y-auto shadow-sm">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-secondary mb-4">Kategorien</h3>
              <div className="space-y-3">
                {(Object.keys(CATEGORY_LABELS) as MaterialCategory[]).map(category => (
                  <label key={category} className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(category)}
                      onChange={() => toggleCategory(category)}
                      className="w-4 h-4 mr-3 text-primary rounded focus:ring-primary"
                    />
                    <span className="text-text-primary">{CATEGORY_LABELS[category]}</span>
                  </label>
                ))}
              </div>
            </div>
          </aside>
        )}

        {/* Main Content */}
        <section className="flex-1 p-6 overflow-y-auto">
          <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-secondary">
                Erste-Hilfe-Bildungsmaterialien
              </h2>
              <div className="flex items-center gap-4">
                <span className="text-text-secondary">
                  {sortedMaterials.length} Materialien
                </span>
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption((e.target as HTMLSelectElement).value as MaterialSortOption)}
                  className="px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="relevance">Sortieren nach: Relevanz</option>
                  <option value="name-asc">Name (A-Z)</option>
                  <option value="category">Kategorie</option>
                </select>
              </div>
            </div>
            <div className="mt-4">
              <input
                type="text"
                placeholder="Materialien suchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
                className="w-full max-w-md px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {isLoading && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
              <p className="text-text-secondary mt-4">Materialien werden geladen...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-6">
              <p>Fehler beim Laden der Materialien: {error}</p>
            </div>
          )}

          {!isLoading && !error && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {sortedMaterials.map(material => (
                  <MaterialCard key={material.id} material={material} />
                ))}
              </div>

              {sortedMaterials.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-text-secondary text-lg">
                    Keine Materialien gefunden.
                  </p>
                </div>
              )}
            </>
          )}
        </section>
      </main>
  );
}
