export function NotFoundPage() {
  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <div className="bg-white p-8 rounded-lg shadow-sm text-center">
        <div className="text-6xl mb-4">404</div>
        <h2 className="text-2xl font-semibold text-secondary mb-2">
          Seite nicht gefunden
        </h2>
        <p className="text-text-secondary mb-6">
          Die angeforderte Seite existiert nicht.
        </p>
        <a
          href="/materials"
          className="inline-block px-6 py-2 bg-primary text-secondary font-medium rounded hover:bg-primary-hover transition-colors"
        >
          Zurück zu Materialien
        </a>
      </div>
    </main>
  );
}
