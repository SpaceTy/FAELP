import { useState } from 'preact/hooks';
import { route } from 'preact-router';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/i18n';
import { consumePostLoginRedirect } from '@/utils/postLoginRedirect';

export function MagicLinkForm() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    console.log('[MAGIC_LINK_FORM] handleSubmit: requesting magic link for email=', email);

    try {
      await login(email);
      console.log('[MAGIC_LINK_FORM] handleSubmit: magic link sent successfully');
      setIsSent(true);
    } catch (err) {
      console.error('[MAGIC_LINK_FORM] handleSubmit: error', err);
      setError(t('login.errorSendMagicLink'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSent) {
    return <CodeEntryForm email={email} />;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-text-primary mb-1">{t('login.emailLabel')}</label>
        <input
          type="email"
          value={email}
          onInput={(e) => setEmail(e.currentTarget.value)}
          placeholder={t('login.emailPlaceholder')}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-primary hover:bg-primary-hover text-white font-semibold py-2 px-4 rounded-md transition-colors disabled:opacity-50"
      >
        {isSubmitting ? t('login.sendingMagicLink') : t('login.sendMagicLink')}
      </button>

      <p className="text-xs text-text-secondary text-center">
        {t('login.emailHelp')}
      </p>
    </form>
  );
}

interface CodeEntryFormProps {
  email: string;
}

function CodeEntryForm({ email }: CodeEntryFormProps) {
  const { t } = useI18n();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const { verifyCode } = useAuth();

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError('');
    setIsVerifying(true);
    console.log('[CODE_ENTRY_FORM] handleSubmit: verifying code for email=', email);

    try {
      await verifyCode(code, email);
      console.log('[CODE_ENTRY_FORM] handleSubmit: code verified successfully, redirecting');
      route(consumePostLoginRedirect());
    } catch (err: any) {
      console.error('[CODE_ENTRY_FORM] handleSubmit: error', err);
      // Check if it's a 422 error (expired/invalid code)
      if (err?.status === 422 || err?.message?.includes('422')) {
        setError(t('login.errorCodeExpired'));
      } else {
        setError(t('login.errorCodeInvalid'));
      }
      setIsVerifying(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-center mb-4">
        <div className="text-green-600 text-4xl mb-2">✓</div>
        <h2 className="text-xl font-semibold text-secondary">{t('login.codeTitle')}</h2>
      </div>

      <p className="text-text-secondary text-center text-sm">
        {t('login.codeSent', { email })}
      </p>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-1">{t('login.codeLabel')}</label>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={code}
          onInput={(e) => setCode(e.currentTarget.value.replace(/\D/g, '').slice(0, 6))}
          placeholder={t('login.codePlaceholder')}
          required
          autoFocus
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-center text-2xl tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {error && <div className="text-red-600 text-sm text-center">{error}</div>}

      <button
        type="submit"
        disabled={isVerifying || code.length !== 6}
        className="w-full bg-primary hover:bg-primary-hover text-white font-semibold py-2 px-4 rounded-md transition-colors disabled:opacity-50"
      >
        {isVerifying ? t('login.verifyingCode') : t('login.signIn')}
      </button>

      <p className="text-xs text-text-secondary text-center">
        {t('login.noEmailHint')}
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="text-sm text-primary hover:underline"
      >
        {t('login.retryWithDifferentEmail')}
      </button>
    </form>
  );
}
