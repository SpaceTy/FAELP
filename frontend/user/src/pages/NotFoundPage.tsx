import { useI18n } from '@/i18n';

export function NotFoundPage() {
  const { t } = useI18n();

  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <div className="bg-white p-8 rounded-lg shadow-sm text-center">
        <div className="text-6xl mb-4">404</div>
        <h2 className="text-2xl font-semibold text-secondary mb-2">
          {t('notFound.title')}
        </h2>
        <p className="text-text-secondary mb-6">
          {t('notFound.body')}
        </p>
        <a
          href="/materials"
          className="inline-block px-6 py-2 bg-primary text-secondary font-medium rounded hover:bg-primary-hover transition-colors"
        >
          {t('notFound.backToMaterials')}
        </a>
      </div>
    </main>
  );
}
