import { useEffect, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { useAuth } from '@/context/AuthContext';

interface CallbackPageProps {
  code?: string;
}

export function CallbackPage({ code }: CallbackPageProps) {
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(true);
  const { verifyCode } = useAuth();

  useEffect(() => {
    if (!code) {
      setError('Ungültiger Magic Link. Bitte fordern Sie einen neuen an.');
      setIsVerifying(false);
      return;
    }

    verifyCode(code)
      .then(() => route('/requests'))
      .catch(() => {
        setError('Der Magic Link ist ungültig oder abgelaufen.');
        setIsVerifying(false);
      });
  }, [code, verifyCode]);

  if (isVerifying) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
        <p className="text-text-secondary">Anmeldung wird überprüft...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="text-red-600 text-5xl mb-4">✗</div>
        <h2 className="text-xl font-semibold text-secondary mb-2">Anmeldung fehlgeschlagen</h2>
        <p className="text-text-secondary mb-4">{error}</p>
        <a href="/login" className="text-primary hover:underline">Zurück zur Anmeldung</a>
      </div>
    );
  }

  return null;
}
