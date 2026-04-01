import { useI18n, type Locale } from '@/i18n';

const locales: Locale[] = ['de', 'en'];

interface LocaleSwitcherProps {
  tone?: 'light' | 'dark';
}

export function LocaleSwitcher({ tone = 'light' }: LocaleSwitcherProps) {
  const { locale, setLocale, t } = useI18n();
  const containerClass =
    tone === 'dark'
      ? 'border-white/20 bg-white/5'
      : 'border-gray-200 bg-gray-50';
  const inactiveButtonClass =
    tone === 'dark'
      ? 'text-slate-200 hover:bg-white/10 hover:text-white'
      : 'text-slate-600 hover:bg-white hover:text-text-primary';

  return (
    <div
      className={`inline-flex items-center rounded-lg border p-1 ${containerClass}`}
      aria-label={t('common.languageSwitcher')}
    >
      {locales.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setLocale(option)}
          title={t(`common.locale.${option}`)}
          aria-pressed={locale === option}
          className={`inline-flex h-7 items-center rounded-md px-2 text-xs font-semibold uppercase tracking-wide transition-colors ${
            locale === option
              ? 'bg-primary text-secondary'
              : inactiveButtonClass
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
