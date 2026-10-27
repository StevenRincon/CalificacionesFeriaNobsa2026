import React from 'react';
import { 
  X, 
  Trophy, 
  Medal, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Sparkles, 
  Users, 
  MapPin, 
  MessageSquare,
  Award
} from 'lucide-react';
import { Project, MetricDefinition } from '../types.ts';
import { formatScore, formatTime } from '../utils/formatters.ts';

interface ProjectDetailModalProps {
  project: Project | null;
  metrics: MetricDefinition[];
  onClose: () => void;
}

export const ProjectDetailModal: React.FC<ProjectDetailModalProps> = ({
  project,
  metrics,
  onClose,
}) => {
  if (!project) return null;

  const isLineCategory = project.categoryId === 'linea';
  const scoreEntries = Object.entries(project.scores || {});

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="cyber-card w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border-cyan-400/50 glow-cyan">
        {/* Header */}
        <div className="px-6 py-4 border-b border-cyan-500/20 flex items-center justify-between bg-[#0a0d14]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold bg-cyan-950 text-cyan-300 px-2 py-0.5 rounded-sm border border-cyan-400">
              [{project.code}]
            </span>
            <span className="text-sm font-black text-white font-display text-glow-cyan tracking-wide">
              FICHA OFICIAL DEL PROYECTO
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-sm text-slate-400 hover:text-cyan-400 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Main info */}
          <div className="space-y-2">
            <h2 className="text-xl font-black text-white font-display tracking-wide">{project.name}</h2>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 font-mono">
              <span className="font-bold text-cyan-300">EQUIPO: {project.team}</span>
              <span>•</span>
              <span className="text-slate-400">{project.institution}</span>
              {project.standNumber && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-amber-300">
                    <MapPin className="w-3.5 h-3.5" />
                    {project.standNumber}
                  </span>
                </>
              )}
            </div>
            <p className="text-xs text-slate-300 leading-relaxed pt-1">
              {project.description}
            </p>

            {project.members && project.members.length > 0 && (
              <div className="pt-2 flex items-center gap-2 text-xs text-slate-400">
                <Users className="w-3.5 h-3.5 text-indigo-400" />
                <span>Integrantes: <strong className="text-slate-200">{project.members.join(', ')}</strong></span>
              </div>
            )}
          </div>

          {/* Evaluations / Attempts Breakdown */}
          {isLineCategory ? (
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 border-b border-slate-800 pb-2 flex items-center gap-2">
                <Clock className="w-4 h-4 text-cyan-400" />
                Historial de Intentos de Carrera (3 Intentos)
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[1, 2, 3].map((num) => {
                  const att = project.attempts?.find((a) => a.attemptNumber === num);
                  return (
                    <div
                      key={num}
                      className="p-3.5 rounded-xl bg-slate-800/70 border border-slate-700 text-center flex flex-col justify-between min-h-[120px]"
                    >
                      <div className="text-xs font-bold text-slate-300">
                        Intento #{num}
                      </div>

                      {att && att.timeSeconds > 0 ? (
                        <div className="my-2">
                          <div className="text-2xl font-black font-mono text-cyan-300">
                            {formatTime(att.timeSeconds)}
                          </div>
                          <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            att.completedTrack
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}>
                            {att.completedTrack ? '✓ Completó Pista' : '✗ No completó (DNF)'}
                          </span>
                        </div>
                      ) : (
                        <div className="my-3 text-xs text-slate-500 font-mono">
                          Sin registrar
                        </div>
                      )}

                      {att?.notes && (
                        <div className="text-[10px] text-slate-400 italic truncate" title={att.notes}>
                          "{att.notes}"
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Summary Stats */}
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/80 grid grid-cols-2 sm:grid-cols-3 gap-3 text-center">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Mejor Tiempo</span>
                  <div className="text-lg font-mono font-bold text-cyan-300">
                    {formatTime(project.bestTime)}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Promedio Oficial</span>
                  <div className="text-lg font-mono font-bold text-slate-200">
                    {formatTime(project.averageTime)}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Pistas Completadas</span>
                  <div className="text-lg font-bold text-emerald-400">
                    {project.completedRunsCount || 0} de 3
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 border-b border-slate-800 pb-2 flex items-center justify-between">
                <span>Evaluaciones de Jurados Oficiales</span>
                <span className="text-emerald-400 font-mono font-bold">
                  Promedio: {formatScore(project.averageScore)} / 100
                </span>
              </h3>

              {scoreEntries.length > 0 ? (
                <div className="space-y-3">
                  {scoreEntries.map(([jurorId, scoreItem]) => (
                    <div
                      key={jurorId}
                      className="p-4 rounded-xl bg-slate-800/70 border border-slate-700 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-white">{scoreItem.jurorName}</p>
                          <p className="text-[10px] text-slate-400">
                            {new Date(scoreItem.updatedAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-base font-black font-mono text-emerald-400">
                            {scoreItem.totalScore.toFixed(2)}
                          </span>
                          <span className="text-[10px] text-slate-400 block">/ 100</span>
                        </div>
                      </div>

                      {/* Rubric metrics breakdown */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 border-t border-slate-700/60">
                        {metrics.map((m) => (
                          <div key={m.id} className="bg-slate-900/60 p-2 rounded-lg text-center">
                            <span title={m.name} className="text-[10px] text-slate-400 truncate block">
                              {m.name} ({Math.round(m.weight * 100)}%)
                            </span>
                            <span className="text-xs font-mono font-bold text-white">
                              {scoreItem.scores[m.id]?.toFixed(0) || '—'}
                            </span>
                          </div>
                        ))}
                      </div>

                      {scoreItem.feedback && (
                        <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] text-slate-300 flex items-start gap-2">
                          <MessageSquare className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
                          <span>"{scoreItem.feedback}"</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center text-slate-500 text-xs">
                  Aún no se han registrado evaluaciones de jurados para este proyecto.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
