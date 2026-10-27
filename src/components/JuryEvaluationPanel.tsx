import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  Sparkles, 
  Save, 
  HelpCircle, 
  Info, 
  Sliders, 
  ChevronRight,
  Send,
  MessageSquare,
  Award,
  AlertCircle
} from 'lucide-react';
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

export const JuryEvaluationPanel: React.FC<JuryEvaluationPanelProps> = ({
  categoryId,
  projects,
  metrics,
  currentUser,
  onSubmitScore,
}) => {
  const categoryProjects = projects.filter((p) => p.categoryId === categoryId);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    categoryProjects[0]?.id || ''
  );

  // Form state
  const [scores, setScores] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState<string>('');
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  const selectedProject = categoryProjects.find((p) => p.id === selectedProjectId);

  // When selected project changes, initialize scores from existing evaluation or default 3.5
  useEffect(() => {
    if (!selectedProject) return;

    const existingEval = selectedProject.scores?.[currentUser.id];
    if (existingEval) {
      setScores(existingEval.scores);
      setFeedback(existingEval.feedback || '');
    } else {
      // Default to 4.0 for all metrics
      const init: Record<string, number> = {};
      metrics.forEach((m) => {
        init[m.id] = 4.0;
      });
      setScores(init);
      setFeedback('');
    }
    setSaveSuccess(false);
  }, [selectedProjectId, selectedProject, currentUser.id, metrics]);

  // Calculate live weighted score
  const calculateTotal = (): number => {
    let total = 0;
    metrics.forEach((m) => {
      const val = scores[m.id] || 0;
      total += val * m.weight;
    });
    return Number(total.toFixed(2));
  };

  const handleScoreChange = (metricId: string, value: number) => {
    const clamped = Math.max(1.0, Math.min(5.0, Number(value.toFixed(1))));
    setScores((prev) => ({
      ...prev,
      [metricId]: clamped,
    }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;

    onSubmitScore(
      selectedProject.id,
      currentUser.id,
      currentUser.name,
      scores,
      feedback
    );

    soundFx.playLapOrFinish();
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
    }, 3000);
  };

  const currentTotal = calculateTotal();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Sidebar: Projects List */}
      <div className="lg:col-span-4 cyber-card p-4 shadow-2xl flex flex-col h-[750px] border-cyan-500/25">
        <div className="pb-3 border-b border-cyan-500/20">
          <h3 className="text-sm font-black text-white flex items-center justify-between font-display text-glow-cyan tracking-wide">
            <span>PROYECTOS ASIGNADOS</span>
            <span className="text-[10px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-400/40 px-2 py-0.5 rounded-sm">
              {categoryProjects.length} EQUIPOS
            </span>
          </h3>
          <p className="text-[11px] text-slate-400 font-mono mt-0.5">
            // Jurado: <strong className="text-cyan-300">{currentUser.name}</strong>
          </p>
        </div>

        {/* List of projects */}
        <div className="flex-1 overflow-y-auto space-y-2 py-3 pr-1">
          {categoryProjects.map((proj) => {
            const isSelected = proj.id === selectedProjectId;
            const myEval = proj.scores?.[currentUser.id];
            const isEvaluated = !!myEval;

            return (
              <button
                key={proj.id}
                onClick={() => setSelectedProjectId(proj.id)}
                className={`w-full text-left p-3 rounded-sm border transition-all flex items-start justify-between gap-3 cursor-pointer ${
                  isSelected
                    ? 'bg-cyan-500/15 border-cyan-400 glow-cyan ring-1 ring-cyan-400/50'
                    : 'bg-[#0a0d14] border-cyan-500/15 hover:border-cyan-400/60'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono font-bold bg-[#11141d] text-cyan-300 px-1.5 py-0.2 rounded-sm border border-cyan-500/40">
                      [{proj.code}]
                    </span>
                    <span className="text-xs font-bold text-white truncate">
                      {proj.name}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5 font-mono">
                    {proj.team} • {proj.institution}
                  </p>
                  {proj.standNumber && (
                    <span className="inline-block mt-1 text-[10px] text-cyan-400/80 font-mono">
                      {proj.standNumber}
                    </span>
                  )}
                </div>

                {/* Status indicator */}
                <div className="text-right flex-shrink-0">
                  {isEvaluated ? (
                    <div className="flex flex-col items-end font-mono">
                      <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-sm font-bold border border-emerald-400">
                        <CheckCircle2 className="w-3 h-3" />
                        {myEval.totalScore.toFixed(2)}
                      </span>
                      <span className="text-[9px] text-slate-400 mt-0.5">CALIFICADO</span>
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded-sm font-medium border border-amber-500/30">
                      <Clock className="w-3 h-3" /> PENDIENTE
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Column: Scoring Form */}
      <div className="lg:col-span-8 cyber-card p-6 shadow-2xl flex flex-col justify-between border-cyan-500/25">
        {selectedProject ? (
          <form onSubmit={handleSave} className="space-y-6">
            {/* Project Header Info */}
            <div className="p-4 rounded-sm bg-[#0a0d14] border border-cyan-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold bg-cyan-950 text-cyan-300 px-2 py-0.5 rounded-sm border border-cyan-400">
                    [{selectedProject.code}]
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    {selectedProject.standNumber || 'Mesa Principal'}
                  </span>
                </div>
                <h2 className="text-lg font-black text-white mt-1 font-display tracking-wide">
                  {selectedProject.name}
                </h2>
                <p className="text-xs text-slate-300 font-medium">
                  {selectedProject.team} — <span className="text-slate-400">{selectedProject.institution}</span>
                </p>
                <p className="text-xs text-slate-400 mt-2 line-clamp-2">
                  {selectedProject.description}
                </p>
              </div>

              {/* Current calculated score chip */}
              <div className="bg-[#11141d] border border-cyan-400/80 p-3.5 rounded-sm text-center min-w-[130px] flex-shrink-0 glow-cyan">
                <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-cyan-400 block">
                  // TU CALIFICACIÓN
                </span>
                <span className="text-3xl font-black text-white font-mono leading-none block my-1 text-glow-cyan">
                  {currentTotal.toFixed(2)}
                </span>
                <span className="text-[10px] text-cyan-400 font-mono font-semibold">
                  ESCALA 1.0 - 5.0
                </span>
              </div>
            </div>

            {/* Metrics Rubric Cards */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 font-mono flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                  RÚBRICA OFICIAL // 4 CRITERIOS AL 25%
                </h3>
                <span className="text-xs text-slate-400 font-mono">
                  PESO TOTAL: 100%
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {metrics.map((metric, idx) => {
                  const val = scores[metric.id] ?? 4.0;
                  return (
                    <div
                      key={metric.id}
                      className="p-4 rounded-sm bg-[#0a0d14] border border-cyan-500/20 hover:border-cyan-400/60 transition-colors flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white flex items-center gap-1.5 font-display">
                            <span className="w-5 h-5 rounded-sm bg-cyan-950 text-cyan-300 border border-cyan-400/60 flex items-center justify-center text-[10px] font-black font-mono">
                              0{idx + 1}
                            </span>
                            {metric.name}
                          </span>
                          <span className="text-[11px] font-mono font-bold text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded-sm border border-cyan-400/30">
                            25%
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                          {metric.description}
                        </p>
                      </div>

                      {/* Slider and quick buttons */}
                      <div className="mt-4 pt-3 border-t border-cyan-500/20">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] text-slate-400 font-mono">PUNTAJE:</span>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={1.0}
                              max={5.0}
                              step={0.1}
                              value={val}
                              onChange={(e) => handleScoreChange(metric.id, parseFloat(e.target.value) || 1.0)}
                              className="w-16 px-2 py-0.5 bg-[#05060a] border border-cyan-400/80 rounded-sm text-right font-mono font-bold text-sm text-cyan-300 focus:outline-none focus:glow-cyan"
                            />
                            <span className="text-xs text-slate-400 font-mono">/5.0</span>
                          </div>
                        </div>

                        {/* Range slider */}
                        <input
                          type="range"
                          min={1.0}
                          max={5.0}
                          step={0.1}
                          value={val}
                          onChange={(e) => handleScoreChange(metric.id, parseFloat(e.target.value))}
                          className="w-full accent-cyan-400 cursor-pointer h-2 bg-slate-900 rounded-lg"
                        />

                        {/* Quick Presets */}
                        <div className="flex items-center justify-between mt-2 pt-1 gap-1 text-[10px] font-mono">
                          {[2.0, 3.0, 3.8, 4.5, 5.0].map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => handleScoreChange(metric.id, preset)}
                              className={`px-1.5 py-0.5 rounded-sm transition-colors cursor-pointer ${
                                Math.abs(val - preset) < 0.05
                                  ? 'bg-cyan-400 text-slate-950 font-black'
                                  : 'bg-[#11141d] text-slate-400 border border-cyan-500/20 hover:text-white'
                              }`}
                            >
                              {preset.toFixed(1)}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Qualitative Feedback */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-cyan-400 font-mono mb-1.5 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                OBSERVACIONES Y RETROALIMENTACIÓN TÉCNICA
              </label>
              <textarea
                rows={2}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Escribe comentarios constructivos sobre la sustentación, diseño electrónico, algoritmos o mejoras sugeridas..."
                className="w-full p-3 bg-[#0a0d14] border border-cyan-500/30 rounded-sm text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:glow-cyan transition-colors resize-none"
              />
            </div>

            {/* Action Bar */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-cyan-500/20">
              <div className="text-xs text-slate-400 font-mono">
                {saveSuccess ? (
                  <span className="text-emerald-400 font-bold flex items-center gap-1 animate-fade-in">
                    <CheckCircle2 className="w-4 h-4" />
                    ¡CALIFICACIÓN SINCRONIZADA POR WEBSOCKETS!
                  </span>
                ) : (
                  <span>
                    // Transmisión en tiempo real al podio y tabla pública.
                  </span>
                )}
              </div>

              <button
                type="submit"
                className="cyber-button-primary w-full sm:w-auto px-6 py-2.5 text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4 text-slate-950" />
                <span>GUARDAR CALIFICACIÓN ({currentTotal.toFixed(2)}/5.0)</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="text-center py-20 text-slate-500">
            Selecciona un proyecto de la lista izquierda para comenzar a evaluar.
          </div>
        )}
      </div>
    </div>
  );
};
