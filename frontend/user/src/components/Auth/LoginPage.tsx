import { MagicLinkForm } from './MagicLinkForm';

export function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="bg-white p-8 rounded-lg shadow-sm max-w-md w-full">
        <h1 className="text-2xl font-bold text-secondary mb-2 text-center">Anmelden</h1>
        <p className="text-text-secondary text-center mb-6">
          Melden Sie sich an, um Materialien anzufordern
        </p>
        <MagicLinkForm />
      </div>
    </div>
  );
}
