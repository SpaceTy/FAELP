import { createContext, type ComponentChildren } from 'preact';
import { useCallback, useContext, useEffect, useMemo, useState } from 'preact/hooks';
import de from './locales/de.json';
import en from './locales/en.json';

export type Locale = 'de' | 'en';
type TranslationParams = Record<string, string | number>;
type Dictionary = typeof de;

const dictionaries: Record<Locale, Dictionary> = { de, en };
const STORAGE_KEY = 'faelp_user_locale';
const defaultLocale: Locale = 'de';

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: TranslationParams) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function isLocale(value: string | null): value is Locale {
  return value === 'de' || value === 'en';
}

function resolveMessage(dictionary: Dictionary, key: string): string | null {
  const value = key.split('.').reduce<unknown>((current, part) => {
    if (!current || typeof current !== 'object' || !(part in current)) {
      return null;
    }

    return (current as Record<string, unknown>)[part];
  }, dictionary);

  return typeof value === 'string' ? value : null;
}

function formatMessage(message: string, params?: TranslationParams) {
  if (!params) {
    return message;
  }

  return message.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = params[key];
    return value === undefined ? `{${key}}` : String(value);
  });
}

function getInitialLocale(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (isLocale(stored)) {
    return stored;
  }

  const browserLocale = navigator.language.toLowerCase();
  if (browserLocale.startsWith('en')) {
    return 'en';
  }

  return defaultLocale;
}

export function translate(locale: Locale, key: string, params?: TranslationParams) {
  const message =
    resolveMessage(dictionaries[locale], key) ??
    resolveMessage(dictionaries[defaultLocale], key) ??
    key;

  return formatMessage(message, params);
}

export function I18nProvider({ children }: { children: ComponentChildren }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, locale);
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
  }, []);

  const t = useCallback(
    (key: string, params?: TranslationParams) => translate(locale, key, params),
    [locale]
  );

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }

  return context;
}
