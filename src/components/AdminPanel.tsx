import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Award, ClipboardCheck, Download, Play, Pause, ShieldCheck, RefreshCw, X } from 'lucide-react';
import { CategoryId, TournamentState, UserAccount } from '../types.ts';
import { CATEGORIES } from '../data/defaultData.ts';
import { formatScore, formatTime } from '../utils/formatters.ts';
import { AdminAccountsPanel } from './AdminAccountsPanel.tsx';

interface AdminPanelProps {
  state: TournamentState;
  activeCategory: CategoryId;
  onUpdateEventStatus: (status: TournamentState['status']) => void;
  onRefreshProjects: () => Promise<void>;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ state, activeCategory, onUpdateEventStatus, onRefreshProjects }) => {
  const [categoryFilter, setCategoryFilter] = useState<CategoryId | 'all'>(activeCategory);
  const [juryAccounts, setJuryAccounts] = useState<UserAccount[]>([]);
  const [selectedJurorId, setSelectedJurorId] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    setCategoryFilter(activeCategory);
  }, [activeCategory]);

  const visibleProjects = useMemo(
    () => state.projects.filter((project) => categoryFilter === 'all' || project.categoryId === categoryFilter),
    [categoryFilter, state.projects]
  );
  const scoreableProjects = useMemo(
    () => state.projects.filter((project) => project.categoryId !== 'linea'),
    [state.projects]
  );
  const juryProgress = useMemo(() => juryAccounts
    .filter((account) => account.role === 'jurado_primaria' || account.role === 'jurado_bachillerato')
    .map((account) => {
      const primaryCount = scoreableProjects.filter(
        (project) => project.categoryId === 'primaria' && project.scores?.[account.id]
      ).length;
      const highSchoolCount = scoreableProjects.filter(
        (project) => project.categoryId === 'bachillerato' && project.scores?.[account.id]
      ).length;

      return {
        id: account.id,
        name: account.name,
        primaryCount,
        highSchoolCount,
        total: primaryCount + highSchoolCount,
      };
    })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'es')),
  [juryAccounts, scoreableProjects]);
  const selectedJuror = juryProgress.find((juror) => juror.id === selectedJurorId);
  const missingProjects = selectedJuror
    ? scoreableProjects.filter((project) => !project.scores?.[selectedJuror.id])
    : [];

  useEffect(() => {
    if (!selectedJurorId) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedJurorId(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedJurorId]);

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
        : project.averageScore
          ? `${project.averageScore}/${project.categoryId === 'primaria' ? 5 : 100}`
          : 'Sin calificar',
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

      <AdminAccountsPanel onAccountsChange={setJuryAccounts} />

      <section className="cyber-card p-5 border-cyan-500/25 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-cyan-400" />
            <div>
              <h3 className="text-sm font-bold text-white">Proyectos calificados por jurado</h3>
              <p className="text-xs text-slate-400">Avance calculado con las calificaciones guardadas, actualizado en tiempo real.</p>
            </div>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            {scoreableProjects.length} proyectos con evaluación por rúbrica
          </span>
        </div>

        {juryProgress.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {juryProgress.map((juror) => {
              const progress = scoreableProjects.length > 0
                ? Math.round((juror.total / scoreableProjects.length) * 100)
                : 0;
              return (
                <article key={juror.id} className="rounded border border-slate-800 bg-[#0a0d14] p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <button
                        type="button"
                        onClick={() => setSelectedJurorId(juror.id)}
                        className="text-left text-sm font-semibold text-white hover:text-cyan-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
                        aria-haspopup="dialog"
                      >
                        {juror.name}
                      </button>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">Jurado evaluador</p>
                    </div>
                    <p className="font-mono text-lg font-bold text-cyan-300">
                      {juror.total}<span className="text-xs text-slate-500">/{scoreableProjects.length}</span>
                    </p>
                  </div>
                  <div
                    className="h-2 overflow-hidden rounded-full bg-slate-800"
                    role="progressbar"
                    aria-label={`Avance de ${juror.name}`}
                    aria-valuemin={0}
                    aria-valuemax={scoreableProjects.length}
                    aria-valuenow={juror.total}
                  >
                    <div className="h-full rounded-full bg-cyan-400 transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="flex justify-between gap-3 text-[11px] text-slate-400">
                    <span>Primaria: <strong className="text-emerald-300">{juror.primaryCount}</strong></span>
                    <span>Bachillerato: <strong className="text-blue-300">{juror.highSchoolCount}</strong></span>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="rounded border border-slate-800 bg-[#0a0d14] p-4 text-xs text-slate-400">
            No hay cuentas de jurado evaluador para mostrar.
          </p>
        )}
      </section>

      {selectedJuror && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedJurorId(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="missing-projects-title"
            className="cyber-card flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden border-cyan-400/50 shadow-2xl"
          >
            <header className="flex items-center justify-between gap-4 border-b border-cyan-500/20 bg-[#0a0d14] px-5 py-4">
              <div>
                <h2 id="missing-projects-title" className="text-base font-bold text-white">
                  Proyectos pendientes de {selectedJuror.name}
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  {missingProjects.length} {missingProjects.length === 1 ? 'proyecto pendiente' : 'proyectos pendientes'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedJurorId(null)}
                className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                aria-label="Cerrar proyectos pendientes"
              >
                <X className="h-5 w-5" />
              </button>
            </header>
            <div className="overflow-y-auto p-5">
              {missingProjects.length > 0 ? (
                <ul className="space-y-2">
                  {missingProjects.map((project) => {
                    const category = CATEGORIES.find((item) => item.id === project.categoryId);
                    return (
                      <li key={project.id} className="rounded border border-slate-800 bg-[#0a0d14] p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-white">{project.name}</p>
                            <p className="mt-1 text-xs text-slate-400">
                              {project.team} · {project.institution}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2 font-mono text-[10px]">
                            <span className="rounded border border-cyan-500/30 px-2 py-1 text-cyan-300">
                              {project.code}
                            </span>
                            <span className="text-slate-400">{category?.shortName || project.categoryId}</span>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="rounded border border-emerald-500/20 bg-emerald-500/5 p-5 text-center text-sm text-emerald-300">
                  Este jurado ya calificó todos los proyectos de Primaria y Bachillerato.
                </p>
              )}
            </div>
          </section>
        </div>
      )}

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
                          : project.averageScore ? <span className="text-emerald-400 font-bold">{formatScore(project.averageScore)}/{project.categoryId === 'primaria' ? 5 : 100}</span> : <span className="text-slate-500">Pendiente</span>}
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
