import { useState } from 'preact/hooks';
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
    return (
      <div className="text-center p-6">
        <div className="text-green-600 text-5xl mb-4">✓</div>
        <h2 className="text-xl font-semibold text-secondary mb-2">Magic Link gesendet!</h2>
        <p className="text-text-secondary">
          Bitte überprüfen Sie Ihre E-Mail ({email}) und klicken Sie auf den Link.
        </p>
      </div>
    );
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
