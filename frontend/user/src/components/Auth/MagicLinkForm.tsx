import { useState } from 'preact/hooks';
import { route } from 'preact-router';
import { useAuth } from '@/context/AuthContext';

export function MagicLinkForm() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await login(email);
      setIsSent(true);
    } catch {
      setError('Fehler beim Senden des Magic Links. Bitte versuchen Sie es erneut.');
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
        <label className="block text-sm font-medium text-text-primary mb-1">E-Mail-Adresse</label>
        <input
          type="email"
          value={email}
          onInput={(e) => setEmail(e.currentTarget.value)}
          placeholder="ihre@email.de"
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
        {isSubmitting ? 'Wird gesendet...' : 'Magic Link senden'}
      </button>

      <p className="text-xs text-text-secondary text-center">
        Kein Passwort erforderlich. Wir senden Ihnen einen sicheren Anmeldelink.
      </p>
    </form>
  );
}

interface CodeEntryFormProps {
  email: string;
}

function CodeEntryForm({ email }: CodeEntryFormProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const { verifyCode } = useAuth();

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError('');
    setIsVerifying(true);

    try {
      await verifyCode(code, email);
      route('/requests');
    } catch (err: any) {
      // Check if it's a 422 error (expired/invalid code)
      if (err?.status === 422 || err?.message?.includes('422')) {
        setError('Der Code ist abgelaufen (gültig für 10 Minuten). Bitte fordern Sie einen neuen Code an.');
      } else {
        setError('Der Code ist ungültig. Bitte überprüfen Sie die Eingabe.');
      }
      setIsVerifying(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-center mb-4">
        <div className="text-green-600 text-4xl mb-2">✓</div>
        <h2 className="text-xl font-semibold text-secondary">Code eingeben</h2>
      </div>

      <p className="text-text-secondary text-center text-sm">
        Wir haben einen 6-stelligen Code an <strong>{email}</strong> gesendet.
      </p>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-1">Einmalcode</label>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={code}
          onInput={(e) => setCode(e.currentTarget.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="123456"
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
        {isVerifying ? 'Wird geprüft...' : 'Anmelden'}
      </button>

      <p className="text-xs text-text-secondary text-center">
        Haben Sie keine E-Mail erhalten? Überprüfen Sie Ihren Spam-Ordner.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="text-sm text-primary hover:underline"
      >
        Mit anderer E-Mail versuchen
      </button>
    </form>
  );
}
