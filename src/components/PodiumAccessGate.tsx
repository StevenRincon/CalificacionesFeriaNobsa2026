import React, { useState } from 'react';
import { LockKeyhole } from 'lucide-react';

interface PodiumAccessGateProps {
  categoryName: string;
  onUnlock: () => void;
}

export const PodiumAccessGate: React.FC<PodiumAccessGateProps> = ({ categoryName, onUnlock }) => {
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/podium-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const result: { error?: string; success?: boolean } = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || `El servidor respondió ${response.status}.`);
      }
      setPassword('');
      onUnlock();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No se pudo verificar la clave.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="cyber-card mx-auto max-w-lg p-8 text-center space-y-5 border-amber-500/30">
      <LockKeyhole className="mx-auto h-10 w-10 text-amber-300" />
      <div className="space-y-2">
        <h2 className="text-lg font-bold text-white">Podio protegido</h2>
        <p className="text-sm text-slate-400">
          Ingresa la clave para consultar los resultados de {categoryName}.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4 text-left">
        <label className="block text-xs font-semibold text-slate-300">
          CLAVE DE ACCESO
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 min-h-11 w-full rounded-sm border border-amber-500/30 bg-[#0a0d14] px-3 text-sm text-white focus:outline-none focus:border-amber-400"
          />
        </label>
        {errorMessage && (
          <p role="alert" className="text-xs text-rose-300">{errorMessage}</p>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="cyber-button-primary min-h-11 w-full text-sm font-bold disabled:opacity-60"
        >
          {isSubmitting ? 'VERIFICANDO…' : 'VER PODIO'}
        </button>
      </form>
    </section>
  );
};
