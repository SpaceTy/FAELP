import { useState } from 'preact/hooks';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/i18n';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, verifyCode } = useAuth();
  const { t } = useI18n();

  const handleEmailSubmit = async (e: Event) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email);
      setStep('code');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.errorSendMagicLink'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeSubmit = async (e: Event) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await verifyCode(code, email);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.errorInvalidCode'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div className="flex items-center justify-end">
          <LocaleSwitcher />
        </div>
        <div>
          <h2 className="text-3xl font-bold text-center text-secondary">
            {t('login.title')}
          </h2>
          <p className="mt-2 text-center text-text-secondary">
            {step === 'email' ? t('login.subtitleEmail') : t('login.subtitleCode')}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded text-sm">
            {error}
          </div>
        )}

        {step === 'email' ? (
          <form onSubmit={handleEmailSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-text-primary">
                {t('login.emailLabel')}
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail((e.target as HTMLInputElement).value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder={t('login.emailPlaceholder')}
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2 px-4 bg-primary text-white font-medium rounded hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
              {isLoading ? t('login.sendingMagicLink') : t('login.sendMagicLink')}
            </button>
          </form>
        ) : (
          <form onSubmit={handleCodeSubmit} className="space-y-6">
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-text-primary">
                {t('login.codeLabel')}
              </label>
              <input
                id="code"
                type="text"
                required
                value={code}
                onChange={(e) => setCode((e.target as HTMLInputElement).value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder={t('login.codePlaceholder')}
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2 px-4 bg-primary text-white font-medium rounded hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
              {isLoading ? t('login.verifyingCode') : t('login.verifyCode')}
            </button>
            <button
              type="button"
              onClick={() => setStep('email')}
              className="w-full py-2 px-4 text-text-secondary hover:text-text-primary transition-colors"
            >
              {t('login.backToEmail')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
