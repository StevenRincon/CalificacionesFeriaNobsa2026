import React, { useState } from 'react';
import { X, KeyRound, Lock } from 'lucide-react';
import { UserAccount } from '../types.ts';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectUser: (user: UserAccount) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onSelectUser }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const result: { error?: string; user?: UserAccount } = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          result.error ||
          `El servidor respondió ${response.status}. Comprueba que el último despliegue incluya la función API.`
        );
      }
      if (!result.user) throw new Error('El servidor no devolvió una cuenta válida.');
      onSelectUser(result.user);
      setUsername('');
      setPassword('');
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Error al iniciar sesión.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="cyber-card w-full max-w-lg shadow-2xl overflow-hidden border-cyan-400/50 glow-cyan">
        <div className="px-6 py-4 border-b border-cyan-500/20 flex items-center justify-between bg-[#0a0d14]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-sm bg-cyan-950/80 text-cyan-400 border border-cyan-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white font-display tracking-wide">INICIO DE SESIÓN</h2>
              <p className="text-xs text-slate-400 font-mono">Acceso seguro para jurados y administración</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="p-1.5 text-slate-400 hover:text-cyan-400 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleLogin} className="p-6 space-y-4 font-mono">
          <div className="flex items-start gap-2 p-3 rounded-sm bg-cyan-500/5 border border-cyan-500/20 text-xs text-slate-300">
            <Lock className="w-4 h-4 text-cyan-400 shrink-0" />
            <p>Las credenciales son verificadas por el servidor. Cada jurado solo puede calificar su categoría asignada.</p>
          </div>
          {errorMessage && (
            <div role="alert" className="p-3 rounded-sm bg-rose-500/10 border border-rose-500/40 text-rose-300 text-xs">
              {errorMessage}
            </div>
          )}
          <label className="block text-xs font-semibold text-slate-300">
            USUARIO
            <input
              autoComplete="username"
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="mt-1 w-full px-3 py-2 bg-[#0a0d14] border border-cyan-500/30 rounded-sm text-sm text-white focus:outline-none focus:border-cyan-400"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-300">
            CONTRASEÑA
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full px-3 py-2 bg-[#0a0d14] border border-cyan-500/30 rounded-sm text-sm text-white focus:outline-none focus:border-cyan-400"
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-sm text-xs font-bold text-slate-300 bg-[#11141d] border border-cyan-500/30 cursor-pointer">
              CANCELAR
            </button>
            <button disabled={isSubmitting} type="submit" className="cyber-button-primary px-5 py-2 text-xs disabled:opacity-60">
              {isSubmitting ? 'VERIFICANDO…' : 'INICIAR SESIÓN'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
