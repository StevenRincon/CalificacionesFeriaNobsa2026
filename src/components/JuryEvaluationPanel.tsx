import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, MessageSquare, Save, Search, Sliders, X } from 'lucide-react';
import { CategoryId, MetricDefinition, Project, UserAccount } from '../types.ts';
import { soundFx } from '../utils/audio.ts';

interface JuryEvaluationPanelProps {
  categoryId: CategoryId;
  projects: Project[];
  metrics: MetricDefinition[];
  currentUser: UserAccount;
  onSubmitScore: (
    projectId: string,
    jurorId: string,
    jurorName: string,
    scores: Record<string, number>,
    feedback?: string
  ) => void;
}

function normalizeText(value: string) {
  return value.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export const JuryEvaluationPanel: React.FC<JuryEvaluationPanelProps> = ({
  categoryId,
  projects,
  metrics,
  currentUser,
  onSubmitScore,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const categoryProjects = useMemo(() => {
    const query = normalizeText(searchTerm.trim());
    return projects.filter((project) => {
      if (project.categoryId !== categoryId) return false;
      if (!query) return true;
      const searchable = normalizeText([
        project.name,
        project.team,
        ...(project.members || []),
      ].join(' '));
      return searchable.includes(query);
    });
  }, [categoryId, projects, searchTerm]);

  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const existingEvaluation = selectedProject?.scores?.[currentUser.id];

  useEffect(() => {
    if (!selectedProject) return;
    if (existingEvaluation) {
      setScores({ ...existingEvaluation.scores });
      setFeedback(existingEvaluation.feedback || '');
    } else {
      setScores(Object.fromEntries(metrics.map((metric) => [metric.id, 4.0])));
      setFeedback('');
    }
    setSaveSuccess(false);
  }, [selectedProject, existingEvaluation, metrics]);

  useEffect(() => {
    if (!selectedProjectId) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedProjectId(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedProjectId]);

  const currentTotal = metrics.reduce(
    (total, metric) => total + (scores[metric.id] ?? 4) * metric.weight,
    0
  );

  const handleScoreChange = (metricId: string, value: number) => {
    const clamped = Math.max(1, Math.min(5, Number(value.toFixed(1))));
    setScores((current) => ({ ...current, [metricId]: clamped }));
  };

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedProject) return;
    onSubmitScore(selectedProject.id, currentUser.id, currentUser.name, scores, feedback);
    soundFx.playLapOrFinish();
    setSaveSuccess(true);
    window.setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <section className="space-y-4">
      <div className="cyber-card p-4 sm:p-5 border-cyan-500/25">
        <div className="flex flex-col gap-1">
          <h2 className="text-base sm:text-lg font-bold text-white">Proyectos por evaluar</h2>
          <p className="text-xs text-slate-400">Jurado: {currentUser.name} · {categoryProjects.length} proyectos</p>
        </div>
        <label className="relative block mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400" />
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar por proyecto o participante"
            aria-label="Buscar por nombre de proyecto o participante"
            className="w-full min-h-12 pl-10 pr-3 rounded-sm bg-[#0a0d14] border border-cyan-500/30 text-base sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
          />
        </label>
      </div>

      <div className="space-y-3">
        {categoryProjects.map((project) => {
          const evaluation = project.scores?.[currentUser.id];
          return (
            <article key={project.id} className="cyber-card p-4 border-cyan-500/20 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-white leading-snug break-words">{project.name}</h3>
                <p className="mt-1 text-sm text-slate-400 break-words">
                  {project.members?.length ? project.members.join(', ') : project.team}
                </p>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-2">
                {evaluation ? (
                  <span className="inline-flex min-h-10 items-center gap-1.5 rounded-sm border border-emerald-500/40 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-300">
                    <CheckCircle2 className="w-4 h-4" />
                    {evaluation.totalScore.toFixed(2)} / 5
                  </span>
                ) : (
                  <span className="inline-flex min-h-10 items-center gap-1.5 rounded-sm border border-amber-500/30 bg-amber-500/10 px-3 text-xs font-semibold text-amber-200">
                    <Clock className="w-4 h-4" /> Pendiente
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedProjectId(project.id)}
                  className="cyber-button-primary min-h-11 min-w-28 px-4 text-sm font-bold"
                >
                  {evaluation ? 'Modificar' : 'Evaluar'}
                </button>
              </div>
            </article>
          );
        })}
        {categoryProjects.length === 0 && (
          <div className="cyber-card p-8 text-center text-sm text-slate-400">
            {searchTerm ? 'No hay proyectos o participantes que coincidan con la búsqueda.' : 'No hay proyectos para esta categoría.'}
          </div>
        )}
      </div>

      {selectedProject && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedProjectId(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="evaluation-title"
            className="w-full max-w-3xl max-h-[95dvh] sm:max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-xl border border-cyan-500/40 bg-[#080b12] shadow-2xl"
          >
            <header className="sticky top-0 z-10 border-b border-cyan-500/20 bg-[#080b12]/95 p-3 sm:p-4 backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wider text-cyan-300">Evaluación del proyecto</p>
                  <h2 id="evaluation-title" className="mt-1 text-base sm:text-lg font-bold leading-snug text-white break-words">
                    {selectedProject.name}
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    {selectedProject.members?.length ? selectedProject.members.join(', ') : selectedProject.team}
                  </p>
                </div>
              <button
                type="button"
                onClick={() => setSelectedProjectId(null)}
                aria-label="Cerrar evaluación"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded border border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
              </div>
              <div className="mt-3 flex items-center justify-between rounded border border-cyan-500/40 bg-cyan-950/60 px-3 py-2 shadow-lg">
                <span className="text-xs sm:text-sm font-semibold text-slate-200">Puntaje global</span>
                <span className="text-xl sm:text-2xl font-black text-cyan-300">{currentTotal.toFixed(2)} / 5.00</span>
              </div>
            </header>

            <form onSubmit={handleSave} className="space-y-5 p-4 sm:p-6">
              <div className="space-y-3">
                {metrics.map((metric, index) => {
                  const value = scores[metric.id] ?? 4;
                  return (
                    <fieldset key={metric.id} className="rounded border border-cyan-500/20 bg-[#0d111a] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <legend className="text-sm font-semibold text-white">{index + 1}. {metric.name}</legend>
                        <span className="shrink-0 text-xs text-cyan-300">{Math.round(metric.weight * 100)}%</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">{metric.description}</p>
                      <div className="mt-4 flex items-center gap-4">
                        <input
                          type="range"
                          min={metric.min}
                          max={metric.max}
                          step={0.1}
                          value={value}
                          aria-label={`Puntaje ${metric.name}`}
                          onChange={(event) => handleScoreChange(metric.id, Number(event.target.value))}
                          className="h-8 min-w-0 flex-1 accent-cyan-400"
                        />
                        <input
                          type="number"
                          min={metric.min}
                          max={metric.max}
                          step={0.1}
                          value={value}
                          onChange={(event) => handleScoreChange(metric.id, Number(event.target.value) || metric.min)}
                          aria-label={`Puntaje numérico ${metric.name}`}
                          className="h-11 w-20 rounded border border-cyan-500/40 bg-[#05060a] px-2 text-center text-base font-bold text-cyan-200"
                        />
                      </div>
                    </fieldset>
                  );
                })}
              </div>

              <label className="block text-sm font-semibold text-slate-200">
                <span className="mb-2 flex items-center gap-2"><MessageSquare className="h-4 w-4 text-cyan-300" /> Observaciones</span>
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={feedback}
                  onChange={(event) => setFeedback(event.target.value)}
                  placeholder="Comentarios para el proyecto"
                  className="w-full rounded border border-cyan-500/30 bg-[#0a0d14] p-3 text-base font-normal text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </label>

              <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-cyan-500/20 bg-[#080b12] py-3 sm:flex-row sm:justify-end">
                {saveSuccess && <p role="status" className="self-center text-sm text-emerald-300">Calificación guardada y sincronizada.</p>}
                <button
                  type="button"
                  onClick={() => setSelectedProjectId(null)}
                  className="min-h-12 rounded border border-slate-600 px-5 text-sm font-semibold text-slate-200"
                >
                  Cerrar
                </button>
                <button type="submit" className="cyber-button-primary min-h-12 px-5 text-sm font-bold flex items-center justify-center gap-2">
                  <Save className="h-4 w-4" />
                  {existingEvaluation ? 'Guardar cambios' : 'Guardar evaluación'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
};
