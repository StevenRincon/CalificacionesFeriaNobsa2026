import React from 'react';
import confetti from 'canvas-confetti';
import { Trophy, Medal, Award, Clock, PartyPopper } from 'lucide-react';
import { CategoryId, Project } from '../types.ts';
import { formatScore, formatTime, rankProjects } from '../utils/formatters.ts';
import { soundFx } from '../utils/audio.ts';

interface PodiumViewProps {
  categoryId: CategoryId;
  projects: Project[];
  onSelectProject?: (project: Project) => void;
}

export const PodiumView: React.FC<PodiumViewProps> = ({
  categoryId,
  projects,
  onSelectProject,
}) => {
  const ranked = rankProjects(projects, categoryId);
  const first = ranked[0];
  const second = ranked[1];
  const third = ranked[2];

  const triggerCelebration = () => {
    soundFx.playFanfare();
    confetti({
      particleCount: 90,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#00f3ff', '#3b82f6', '#f59e0b', '#10b981', '#ffffff'],
    });
  };

  const isLineCategory = categoryId === 'linea';

  return (
    <div className="relative overflow-hidden cyber-card p-6 shadow-2xl mb-8 border border-cyan-500/30">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Podium Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between pb-5 border-b border-cyan-500/20 gap-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-400/60 glow-cyan">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2 font-display text-glow-cyan tracking-wide">
              PODIO OFICIAL DE HONOR
              <span className="text-[10px] uppercase font-mono px-2.5 py-0.5 rounded-sm bg-cyan-950 text-cyan-300 border border-cyan-400/50 font-bold">
                TOP 3 // OFICIAL
              </span>
            </h2>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              {isLineCategory
                ? '// REGLA: Menor tiempo en pista completada + promedio oficial validado'
                : '// REGLA: Calificación ponderada por rúbrica de 4 criterios (1.0 a 5.0)'}
            </p>
          </div>
        </div>

        <button
          onClick={triggerCelebration}
          className="cyber-button-primary px-4 py-2 text-xs flex items-center gap-2 cursor-pointer"
        >
          <PartyPopper className="w-4 h-4 text-slate-950" />
          <span>¡CELEBRAR CON CONFETI!</span>
        </button>
      </div>

      {/* Podium Pedestals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-8 items-end max-w-4xl mx-auto relative z-10">
        
        {/* --- 2ND PLACE (SILVER) --- */}
        <div className="order-2 md:order-1 flex flex-col items-center">
          {second ? (
            <div
              onClick={() => onSelectProject?.(second)}
              className="w-full bg-[#11141d]/90 hover:bg-[#161b27] border border-slate-400/60 hover:border-cyan-400 rounded-sm p-4 shadow-lg transition-all cursor-pointer group text-center relative flex flex-col justify-between min-h-[220px]"
            >
              {/* Medal tag */}
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-sm bg-slate-200 text-slate-950 text-[10px] font-mono font-black shadow-md flex items-center gap-1 border border-white">
                <Medal className="w-3.5 h-3.5 text-slate-800" /> 2° LUGAR // PLATA
              </div>

              <div className="pt-3">
                <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-widest block">
                  [{second.code}]
                </span>
                <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors line-clamp-2 mt-1">
                  {second.name}
                </h3>
                <p className="text-xs text-slate-300 font-medium truncate mt-0.5">
                  {second.team}
                </p>
                <p className="text-[11px] text-slate-400 truncate">
                  {second.institution}
                </p>
              </div>

              {/* Metric display */}
              <div className="mt-4 pt-3 border-t border-cyan-500/20 bg-slate-950/60 rounded p-2.5">
                {isLineCategory ? (
                  <div>
                    <div className="text-[10px] uppercase font-mono text-slate-400">Mejor Tiempo:</div>
                    <div className="text-xl font-black text-cyan-300 font-mono">
                      {formatTime(second.bestTime)}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono flex items-center justify-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3 text-cyan-400" />
                      <span>Prom: {formatTime(second.averageTime)}</span>
                    </div>
                    <span className={`inline-block mt-1 text-[9px] font-mono px-2 py-0.5 rounded-sm font-bold ${
                      second.hasCompletedTrack
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    }`}>
                      {second.completedRunsCount}/3 COMPLETADAS
                    </span>
                  </div>
                ) : (
                  <div>
                    <div className="text-[10px] uppercase font-mono text-slate-400">Nota Final:</div>
                    <div className="text-2xl font-black text-white font-mono">
                      {formatScore(second.averageScore)}
                      <span className="text-xs text-slate-400 font-normal"> / 5.0</span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {second.evaluationsCount || 0} JURADOS
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="w-full bg-[#11141d]/40 border border-dashed border-cyan-500/20 rounded p-6 text-center text-slate-500 text-xs font-mono">
              [ Esperando 2° Lugar ]
            </div>
          )}

          {/* Pedestal Bar */}
          <div className="hidden md:flex w-full h-20 bg-gradient-to-t from-slate-900 to-[#11141d] rounded-t-sm mt-3 items-center justify-center border-t border-slate-400/50 shadow-inner">
            <span className="text-3xl font-black font-display text-slate-500/30">2</span>
          </div>
        </div>

        {/* --- 1ST PLACE (GOLD) --- */}
        <div className="order-1 md:order-2 flex flex-col items-center">
          {first ? (
            <div
              onClick={() => onSelectProject?.(first)}
              className="w-full bg-gradient-to-b from-amber-950/40 via-[#11141d] to-[#11141d] border-2 border-amber-400 hover:border-cyan-300 rounded-sm p-5 shadow-2xl shadow-amber-500/20 transition-all cursor-pointer group text-center relative flex flex-col justify-between min-h-[250px] -mt-2 glow-cyan"
            >
              {/* Crown Medal tag */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-sm bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 text-xs font-mono font-black shadow-lg flex items-center gap-1.5 border border-amber-200">
                <Trophy className="w-4 h-4 text-slate-950 fill-current" /> 1° CAMPEÓN ORO
              </div>

              <div className="pt-4">
                <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-widest block">
                  [{first.code}]
                </span>
                <h3 className="text-base font-black text-white group-hover:text-amber-300 transition-colors line-clamp-2 mt-1">
                  {first.name}
                </h3>
                <p className="text-xs text-amber-200/90 font-semibold truncate mt-0.5">
                  {first.team}
                </p>
                <p className="text-[11px] text-slate-400 truncate">
                  {first.institution}
                </p>
              </div>

              {/* Metric display */}
              <div className="mt-4 pt-3 border-t border-amber-500/30 bg-amber-500/10 rounded p-3">
                {isLineCategory ? (
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-amber-300 font-bold">
                      // MEJOR TIEMPO (ORO)
                    </div>
                    <div className="text-3xl font-black text-amber-300 font-mono tracking-tight drop-shadow-sm text-glow-cyan">
                      {formatTime(first.bestTime)}
                    </div>
                    <div className="text-[10px] text-slate-300 font-mono flex items-center justify-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3 text-amber-400" />
                      <span>Promedio: {formatTime(first.averageTime)}</span>
                    </div>
                    <span className={`inline-block mt-1 text-[10px] font-mono px-2.5 py-0.5 rounded-sm font-black ${
                      first.hasCompletedTrack
                        ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-400'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}>
                      ✓ {first.completedRunsCount}/3 PISTAS COMPLETADAS
                    </span>
                  </div>
                ) : (
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-amber-300 font-bold">
                      // PUNTAJE MÁXIMO
                    </div>
                    <div className="text-3xl font-black text-amber-300 font-mono">
                      {formatScore(first.averageScore)}
                      <span className="text-sm text-amber-200/70 font-normal"> / 5.0</span>
                    </div>
                    <div className="text-[10px] text-slate-300 font-mono mt-0.5">
                      {first.evaluationsCount || 0} EVALUACIONES OFICIALES
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="w-full bg-[#11141d]/40 border border-dashed border-cyan-500/20 rounded p-6 text-center text-slate-500 text-xs font-mono">
              [ Esperando 1° Lugar ]
            </div>
          )}

          {/* Pedestal Bar */}
          <div className="hidden md:flex w-full h-28 bg-gradient-to-t from-amber-600/30 via-slate-900 to-[#11141d] rounded-t-sm mt-3 items-center justify-center border-t-2 border-amber-400 shadow-xl">
            <span className="text-4xl font-black font-display text-amber-400/40">1</span>
          </div>
        </div>

        {/* --- 3RD PLACE (BRONZE) --- */}
        <div className="order-3 flex flex-col items-center">
          {third ? (
            <div
              onClick={() => onSelectProject?.(third)}
              className="w-full bg-[#11141d]/90 hover:bg-[#161b27] border border-amber-700/70 hover:border-cyan-400 rounded-sm p-4 shadow-lg transition-all cursor-pointer group text-center relative flex flex-col justify-between min-h-[200px]"
            >
              {/* Medal tag */}
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-sm bg-amber-800 text-amber-100 text-[10px] font-mono font-black shadow-md flex items-center gap-1 border border-amber-600">
                <Award className="w-3.5 h-3.5 text-amber-200" /> 3° LUGAR // BRONCE
              </div>

              <div className="pt-3">
                <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-widest block">
                  [{third.code}]
                </span>
                <h3 className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors line-clamp-2 mt-1">
                  {third.name}
                </h3>
                <p className="text-xs text-slate-300 font-medium truncate mt-0.5">
                  {third.team}
                </p>
                <p className="text-[11px] text-slate-400 truncate">
                  {third.institution}
                </p>
              </div>

              {/* Metric display */}
              <div className="mt-4 pt-3 border-t border-cyan-500/20 bg-slate-950/60 rounded p-2.5">
                {isLineCategory ? (
                  <div>
                    <div className="text-[10px] uppercase font-mono text-slate-400">Mejor Tiempo:</div>
                    <div className="text-xl font-black text-amber-400 font-mono">
                      {formatTime(third.bestTime)}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono flex items-center justify-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3 text-cyan-400" />
                      <span>Prom: {formatTime(third.averageTime)}</span>
                    </div>
                    <span className={`inline-block mt-1 text-[9px] font-mono px-2 py-0.5 rounded-sm font-bold ${
                      third.hasCompletedTrack
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    }`}>
                      {third.completedRunsCount}/3 COMPLETADAS
                    </span>
                  </div>
                ) : (
                  <div>
                    <div className="text-[10px] uppercase font-mono text-slate-400">Nota Final:</div>
                    <div className="text-2xl font-black text-white font-mono">
                      {formatScore(third.averageScore)}
                      <span className="text-xs text-slate-400 font-normal"> / 5.0</span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {third.evaluationsCount || 0} JURADOS
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="w-full bg-[#11141d]/40 border border-dashed border-cyan-500/20 rounded p-6 text-center text-slate-500 text-xs font-mono">
              [ Esperando 3° Lugar ]
            </div>
          )}

          {/* Pedestal Bar */}
          <div className="hidden md:flex w-full h-14 bg-gradient-to-t from-slate-900 to-[#11141d] rounded-t-sm mt-3 items-center justify-center border-t border-amber-700/50 shadow-inner">
            <span className="text-2xl font-black font-display text-amber-600/30">3</span>
          </div>
        </div>

      </div>
    </div>
  );
};
