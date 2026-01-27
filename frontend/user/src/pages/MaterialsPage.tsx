import { useState, useMemo } from 'preact/hooks';
import { Header } from '@/components/Layout/Header';
import { MaterialCard } from '@/components/Material/MaterialCard';
import { MATERIAL_CATALOG, CATEGORY_LABELS, type MaterialCategory } from '@/types/material';

export function MaterialsPage() {
  const [selectedCategories, setSelectedCategories] = useState<MaterialCategory[]>([
    'Reanimation',
    'Wundversorgung&Trauma',
    'Zubehoer'
  ]);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredMaterials = useMemo(() => {
    return MATERIAL_CATALOG.filter(material => {
      const matchesCategory = selectedCategories.includes(material.category);
      const matchesSearch = searchQuery === '' || 
        material.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        material.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategories, searchQuery]);

  const toggleCategory = (category: MaterialCategory) => {
    setSelectedCategories(prev => 
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar Filters */}
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

        {/* Main Content */}
        <section className="flex-1 p-6 overflow-y-auto">
          <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-secondary">
                Erste-Hilfe-Bildungsmaterialien
              </h2>
              <div className="flex items-center gap-4">
                <span className="text-text-secondary">
                  {filteredMaterials.length} Materialien
                </span>
                <select className="px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary">
                  <option>Sortieren nach: Relevanz</option>
                  <option>Name (A-Z)</option>
                  <option>Kategorie</option>
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredMaterials.map(material => (
              <MaterialCard key={material.id} material={material} />
            ))}
          </div>

          {filteredMaterials.length === 0 && (
            <div className="text-center py-12">
              <p className="text-text-secondary text-lg">
                Keine Materialien gefunden.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
