import { useEffect, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/i18n';
import { consumePostLoginRedirect } from '@/utils/postLoginRedirect';

interface CallbackPageProps {
  code?: string;
}

export function CallbackPage({ code }: CallbackPageProps) {
  const { t } = useI18n();
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(true);
  const { verifyCode } = useAuth();

  useEffect(() => {
    if (!code) {
      setError(t('callback.invalidLink'));
      setIsVerifying(false);
      return;
    }

    verifyCode(code)
      .then(() => route(consumePostLoginRedirect()))
      .catch(() => {
        setError(t('callback.expiredLink'));
        setIsVerifying(false);
      });
  }, [code, t, verifyCode]);

  if (isVerifying) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
        <p className="text-text-secondary">{t('callback.verifying')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="text-red-600 text-5xl mb-4">✗</div>
        <h2 className="text-xl font-semibold text-secondary mb-2">{t('callback.failedTitle')}</h2>
        <p className="text-text-secondary mb-4">{error}</p>
        <a href="/login" className="text-primary hover:underline">{t('callback.backToLogin')}</a>
      </div>
    );
  }

  return null;
}
