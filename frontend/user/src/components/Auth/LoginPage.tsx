import { MagicLinkForm } from './MagicLinkForm';
import { LocaleSwitcher } from '@/components/Layout/LocaleSwitcher';
import { useI18n } from '@/i18n';

export function LoginPage() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="bg-white p-8 rounded-lg shadow-sm max-w-md w-full">
        <div className="mb-4 flex justify-end">
          <LocaleSwitcher />
        </div>
        <h1 className="text-2xl font-bold text-secondary mb-2 text-center">{t('login.title')}</h1>
        <p className="text-text-secondary text-center mb-6">
          {t('login.subtitle')}
        </p>
        <MagicLinkForm />
      </div>
    </div>
  );
}
