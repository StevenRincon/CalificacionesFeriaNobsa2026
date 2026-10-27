import React, { useEffect, useState } from 'react';
import { UserPlus, Users } from 'lucide-react';
import { UserAccount } from '../types.ts';

const roleLabels = {
  jurado_primaria: 'Jurado — Primaria',
  jurado_bachillerato: 'Jurado — Bachillerato',
  cronometro_linea: 'Jurado — Seguidores de línea',
} as const;

type JuryRole = keyof typeof roleLabels;

export const AdminAccountsPanel: React.FC = () => {
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<JuryRole>('jurado_primaria');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const loadAccounts = async () => {
    const response = await fetch('/api/admin/accounts');
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'No se pudieron cargar las cuentas.');
    setAccounts(result.accounts as UserAccount[]);
  };

  useEffect(() => {
    loadAccounts().catch((error: unknown) => {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : 'Error cargando las cuentas.');
    });
  }, []);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    setIsError(false);
    try {
      const response = await fetch('/api/admin/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, username, password, role }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo crear el acceso.');
      setAccounts((current) => [...current, result.user as UserAccount]);
      setName('');
      setUsername('');
      setPassword('');
      setMessage('Acceso creado correctamente. Entrega al jurado su usuario y contraseña.');
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : 'Error al crear el acceso.');
    }
  };

  return (
    <section className="cyber-card p-5 border-cyan-500/25 space-y-4">
      <div className="flex items-center gap-2">
        <Users className="w-5 h-5 text-cyan-400" />
        <div>
          <h3 className="text-sm font-bold text-white">Accesos de jurados</h3>
          <p className="text-xs text-slate-400">Crea credenciales individuales y asigna cada cuenta a una categoría.</p>
        </div>
      </div>

      <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
        <label className="text-[11px] text-slate-300">
          NOMBRE
          <input required minLength={2} value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full px-3 py-2 bg-[#0a0d14] border border-cyan-500/30 rounded-sm text-xs text-white" />
        </label>
        <label className="text-[11px] text-slate-300">
          USUARIO
          <input required minLength={3} maxLength={32} pattern="[a-zA-Z0-9._-]+" value={username} onChange={(event) => setUsername(event.target.value)} className="mt-1 w-full px-3 py-2 bg-[#0a0d14] border border-cyan-500/30 rounded-sm text-xs text-white" />
        </label>
        <label className="text-[11px] text-slate-300">
          CONTRASEÑA (8+)
          <input required minLength={8} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full px-3 py-2 bg-[#0a0d14] border border-cyan-500/30 rounded-sm text-xs text-white" />
        </label>
        <label className="text-[11px] text-slate-300">
          ROL / CATEGORÍA
          <select value={role} onChange={(event) => setRole(event.target.value as JuryRole)} className="mt-1 w-full px-3 py-2 bg-[#0a0d14] border border-cyan-500/30 rounded-sm text-xs text-white">
            {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <button type="submit" className="cyber-button-primary px-4 py-2 text-xs flex items-center justify-center gap-2">
          <UserPlus className="w-4 h-4" /> CREAR ACCESO
        </button>
      </form>

      {message && <p role={isError ? 'alert' : 'status'} className={`text-xs ${isError ? 'text-rose-300' : 'text-emerald-300'}`}>{message}</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-[10px] uppercase text-slate-400 border-b border-slate-800">
            <tr><th className="py-2 pr-3">Nombre</th><th className="py-2 pr-3">Usuario</th><th className="py-2">Categoría asignada</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {accounts.map((account) => (
              <tr key={account.id}>
                <td className="py-2 pr-3 text-white">{account.name}</td>
                <td className="py-2 pr-3 font-mono text-cyan-300">{account.username}</td>
                <td className="py-2 text-slate-300">{roleLabels[account.role as JuryRole] || account.badge}</td>
              </tr>
            ))}
            {accounts.length === 0 && <tr><td colSpan={3} className="py-3 text-slate-500">Aún no hay cuentas de jurado.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
};
