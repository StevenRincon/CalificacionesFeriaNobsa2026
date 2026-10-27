import React, { useMemo, useState } from 'react';
import { Activity, Award, Download, Play, Pause, ShieldCheck, RefreshCw } from 'lucide-react';
import { CategoryId, TournamentState } from '../types.ts';
import { CATEGORIES } from '../data/defaultData.ts';
import { formatScore, formatTime } from '../utils/formatters.ts';
import { AdminAccountsPanel } from './AdminAccountsPanel.tsx';

interface AdminPanelProps {
  state: TournamentState;
  onUpdateEventStatus: (status: TournamentState['status']) => void;
  onRefreshProjects: () => Promise<void>;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ state, onUpdateEventStatus, onRefreshProjects }) => {
  const [categoryFilter, setCategoryFilter] = useState<CategoryId | 'all'>('all');
  const [refreshError, setRefreshError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const visibleProjects = useMemo(
    () => state.projects.filter((project) => categoryFilter === 'all' || project.categoryId === categoryFilter),
    [categoryFilter, state.projects]
  );

  const exportToCsv = () => {
    const rows = [
      ['Categoría', 'Código', 'Proyecto', 'Equipo', 'Institución', 'Puntaje / Mejor tiempo'],
      ...visibleProjects.map((project) => [
        project.categoryId,
        project.code,
        project.name,
        project.team,
        project.institution,
        project.categoryId === 'linea'
          ? project.bestTime ? `${project.bestTime}s` : 'Sin tiempo válido'
          : project.averageScore ? `${project.averageScore}/5.0` : 'Sin calificar',
      ]),
    ];
    const csv = rows.map((row) => row.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(',')).join('\n');
    const link = document.createElement('a');
    link.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
    link.download = `robos-evaluacion_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const exportToJson = () => {
    const link = document.createElement('a');
    link.href = `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(state, null, 2))}`;
    link.download = `robos-evaluacion_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleRefreshProjects = async () => {
    setIsRefreshing(true);
    setRefreshError('');
    try {
      await onRefreshProjects();
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : 'No se pudieron actualizar los proyectos.');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="cyber-card p-6 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 border-cyan-500/30">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-sm bg-amber-500/20 text-amber-400 border border-amber-400">
            <ShieldCheck className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-lg font-black text-white font-display tracking-wide">PANEL DE ADMINISTRACIÓN</h2>
            <p className="text-xs text-slate-400 font-mono">Inscripciones desde MongoDB · calificaciones sincronizadas en tiempo real</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 font-mono">
          <span className="text-xs text-cyan-400 font-bold uppercase">ESTADO:</span>
          <button onClick={() => onUpdateEventStatus('active')} className={`px-3 py-1.5 rounded-sm text-xs font-bold flex items-center gap-1.5 ${state.status === 'active' ? 'bg-emerald-500 text-slate-950' : 'bg-[#11141d] text-slate-400 border border-cyan-500/20'}`}>
            <Play className="w-3.5 h-3.5" /> EN CURSO
          </button>
          <button onClick={() => onUpdateEventStatus('paused')} className={`px-3 py-1.5 rounded-sm text-xs font-bold flex items-center gap-1.5 ${state.status === 'paused' ? 'bg-amber-400 text-slate-950' : 'bg-[#11141d] text-slate-400 border border-cyan-500/20'}`}>
            <Pause className="w-3.5 h-3.5" /> EN PAUSA
          </button>
          <button onClick={() => onUpdateEventStatus('finished')} className={`px-3 py-1.5 rounded-sm text-xs font-bold flex items-center gap-1.5 ${state.status === 'finished' ? 'bg-purple-500 text-slate-950' : 'bg-[#11141d] text-slate-400 border border-cyan-500/20'}`}>
            <Award className="w-3.5 h-3.5" /> PREMIACIÓN
          </button>
        </div>
      </section>

      <AdminAccountsPanel />

      <section className="cyber-card p-4 border-cyan-500/25 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-300">
          Los proyectos se leen de <code className="text-cyan-300">registrations</code>. Para inscribir, editar o eliminar proyectos, usa el sistema de inscripciones; sus documentos no se modifican aquí.
        </p>
        <div className="flex gap-2">
          <button onClick={exportToCsv} className="px-3.5 py-2 rounded-sm bg-[#11141d] text-cyan-300 font-mono font-bold text-xs border border-cyan-500/30 flex items-center gap-1.5">
            <Download className="w-4 h-4" /> EXPORTAR CSV
          </button>
          <button onClick={exportToJson} className="px-3.5 py-2 rounded-sm bg-[#11141d] text-cyan-300 font-mono font-bold text-xs border border-cyan-500/30 flex items-center gap-1.5">
            <Download className="w-4 h-4" /> EXPORTAR JSON
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">
                Proyectos inscritos <span className="ml-1 text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">{visibleProjects.length}</span>
              </h3>
              <button
                type="button"
                onClick={handleRefreshProjects}
                disabled={isRefreshing}
                className="p-1.5 rounded border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10 disabled:opacity-50"
                title="Volver a consultar registrations"
                aria-label="Actualizar proyectos inscritos"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <label className="flex items-center gap-2 text-[11px] text-slate-400">
              CATEGORÍA
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as CategoryId | 'all')} className="px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-white">
                <option value="all">Todas</option>
                {CATEGORIES.map((category) => <option key={category.id} value={category.id}>{category.shortName}</option>)}
              </select>
            </label>
          </div>
          {refreshError && <p role="alert" className="mt-2 text-xs text-rose-300">{refreshError}</p>}
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-800/60 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                  <th className="py-2.5 px-3">Código</th>
                  <th className="py-2.5 px-3">Proyecto / Equipo</th>
                  <th className="py-2.5 px-3">Categoría</th>
                  <th className="py-2.5 px-3 text-center">Puntaje / Tiempo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {visibleProjects.map((project) => {
                  const category = CATEGORIES.find((item) => item.id === project.categoryId);
                  return (
                    <tr key={project.id} className="hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-300">{project.code}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-white">{project.name}</div>
                        <div className="text-[11px] text-slate-400">{project.team} · {project.institution}</div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-300">{category?.shortName || project.categoryId}</td>
                      <td className="py-2.5 px-3 text-center font-mono">
                        {project.categoryId === 'linea'
                          ? project.bestTime ? <span className="text-cyan-300 font-bold">{formatTime(project.bestTime)}</span> : <span className="text-slate-500">Sin tiempo</span>
                          : project.averageScore ? <span className="text-emerald-400 font-bold">{formatScore(project.averageScore)}/5.0</span> : <span className="text-slate-500">Pendiente</span>}
                      </td>
                    </tr>
                  );
                })}
                {visibleProjects.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-500">
                      No se recibieron proyectos para esta categoría.{' '}
                      <a href="/api/health" target="_blank" rel="noreferrer" className="text-cyan-300 underline">
                        Revisar diagnóstico de base de datos
                      </a>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col h-[600px]">
          <div className="pb-3 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" /> Auditoría en tiempo real
            </h3>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 py-3 pr-1 text-xs">
            {state.activityLog.map((log) => (
              <article key={log.id} className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-800 text-slate-300 flex flex-col gap-1">
                <div className="flex items-center justify-between text-[10px] text-slate-500">
                  <time>{new Date(log.timestamp).toLocaleTimeString()}</time>
                  <span className="uppercase tracking-wider font-semibold text-slate-400">{log.type}</span>
                </div>
                <p className="text-[11px] text-slate-200 leading-snug">{log.message}</p>
              </article>
            ))}
            {state.activityLog.length === 0 && <p className="text-slate-500">Aún no hay actividad.</p>}
          </div>
        </section>
      </div>
    </div>
  );
};
