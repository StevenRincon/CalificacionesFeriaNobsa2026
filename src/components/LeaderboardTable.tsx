import React, { useState } from 'react';
import { 
  Trophy, 
  Search, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  ChevronRight 
} from 'lucide-react';
import { CategoryId, Project, MetricDefinition } from '../types.ts';
import { formatScore, formatTime, rankProjects } from '../utils/formatters.ts';

interface LeaderboardTableProps {
  categoryId: CategoryId;
  projects: Project[];
  metrics: MetricDefinition[];
  onSelectProject: (project: Project) => void;
}

export const LeaderboardTable: React.FC<LeaderboardTableProps> = ({
  categoryId,
  projects,
  metrics,
  onSelectProject,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const ranked = rankProjects(projects, categoryId);

  const filtered = ranked.filter((p) => {
    const q = searchTerm.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.team.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      p.institution.toLowerCase().includes(q)
    );
  });

  const isLineCategory = categoryId === 'linea';

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return (
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-sm bg-gradient-to-tr from-amber-400 to-amber-300 text-slate-950 font-mono font-black text-xs shadow-md shadow-amber-400/30 border border-amber-200">
            01
          </span>
        );
      case 2:
        return (
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-sm bg-slate-200 text-slate-950 font-mono font-black text-xs shadow-md border border-white">
            02
          </span>
        );
      case 3:
        return (
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-sm bg-amber-800 text-amber-100 font-mono font-black text-xs shadow-md border border-amber-600">
            03
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-sm bg-[#11141d] text-cyan-400 font-mono font-bold text-xs border border-cyan-500/30">
            {rank < 10 ? `0${rank}` : rank}
          </span>
        );
    }
  };

  return (
    <div className="cyber-card overflow-hidden shadow-2xl border-cyan-500/25">
      {/* Header Controls */}
      <div className="p-4 sm:p-5 border-b border-cyan-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0a0d14]/80">
        <div>
          <h3 className="text-base font-black text-white flex items-center gap-2 font-display text-glow-cyan tracking-wide">
            <span>TABLA OFICIAL DE CLASIFICACIÓN EN VIVO</span>
            <span className="text-[10px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-400/40 px-2 py-0.5 rounded-sm">
              {filtered.length} EQUIPOS
            </span>
          </h3>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            {isLineCategory
              ? '// 3 intentos oficiales. Gana el menor tiempo con pista completada.'
              : '// 5 criterios ponderados. Escala de 10 a 100.'}
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-cyan-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filtrar por robot, equipo o colegio..."
            className="w-full pl-9 pr-3 py-1.5 bg-[#0a0d14] border border-cyan-500/30 rounded-sm text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:glow-cyan transition-colors"
          />
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        {isLineCategory ? (
          // TABLE FOR SEGUIDORES DE LÍNEA
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-800/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <th className="py-3 px-4 w-12 text-center">Pos</th>
                <th className="py-3 px-4">Equipo & Robot</th>
                <th className="py-3 px-3 text-center">Intento 1</th>
                <th className="py-3 px-3 text-center">Intento 2</th>
                <th className="py-3 px-3 text-center">Intento 3</th>
                <th className="py-3 px-4 text-center bg-cyan-950/20 text-cyan-300 font-bold">
                  Mejor Tiempo
                </th>
                <th className="py-3 px-4 text-center">Promedio Oficial</th>
                <th className="py-3 px-4 text-center">Pistas Completadas</th>
                <th className="py-3 px-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtered.map((proj) => {
                const att1 = proj.attempts?.find((a) => a.attemptNumber === 1);
                const att2 = proj.attempts?.find((a) => a.attemptNumber === 2);
                const att3 = proj.attempts?.find((a) => a.attemptNumber === 3);

                return (
                  <tr
                    key={proj.id}
                    onClick={() => onSelectProject(proj)}
                    className="hover:bg-slate-800/50 transition-colors cursor-pointer group"
                  >
                    {/* Rank */}
                    <td className="py-3.5 px-4 text-center">
                      {getRankBadge(proj.rank)}
                    </td>

                    {/* Team & Robot */}
                    <td className="py-3.5 px-4 min-w-[220px]">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-semibold border border-slate-700">
                          {proj.code}
                        </span>
                        <span className="font-bold text-white group-hover:text-cyan-300 transition-colors">
                          {proj.name}
                        </span>
                      </div>
                      <div className="text-slate-400 text-[11px] mt-0.5 truncate max-w-xs">
                        {proj.team} • <span className="text-slate-500">{proj.institution}</span>
                      </div>
                    </td>

                    {/* Attempt 1 */}
                    <td className="py-3.5 px-3 text-center">
                      {att1 && att1.timeSeconds > 0 ? (
                        <div className="inline-flex flex-col items-center">
                          <span className="font-mono font-semibold text-slate-200">
                            {formatTime(att1.timeSeconds)}
                          </span>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold flex items-center gap-0.5 ${
                            att1.completedTrack ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-400'
                          }`}>
                            {att1.completedTrack ? '✓ Completó' : '✗ DNF'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-600 font-mono text-[11px]">-</span>
                      )}
                    </td>

                    {/* Attempt 2 */}
                    <td className="py-3.5 px-3 text-center">
                      {att2 && att2.timeSeconds > 0 ? (
                        <div className="inline-flex flex-col items-center">
                          <span className="font-mono font-semibold text-slate-200">
                            {formatTime(att2.timeSeconds)}
                          </span>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold flex items-center gap-0.5 ${
                            att2.completedTrack ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-400'
                          }`}>
                            {att2.completedTrack ? '✓ Completó' : '✗ DNF'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-600 font-mono text-[11px]">-</span>
                      )}
                    </td>

                    {/* Attempt 3 */}
                    <td className="py-3.5 px-3 text-center">
                      {att3 && att3.timeSeconds > 0 ? (
                        <div className="inline-flex flex-col items-center">
                          <span className="font-mono font-semibold text-slate-200">
                            {formatTime(att3.timeSeconds)}
                          </span>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold flex items-center gap-0.5 ${
                            att3.completedTrack ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-400'
                          }`}>
                            {att3.completedTrack ? '✓ Completó' : '✗ DNF'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-600 font-mono text-[11px]">-</span>
                      )}
                    </td>

                    {/* Best Time */}
                    <td className="py-3.5 px-4 text-center bg-cyan-950/10">
                      {proj.hasCompletedTrack && proj.bestTime ? (
                        <div className="inline-flex flex-col items-center">
                          <span className="font-mono font-black text-sm text-cyan-300">
                            {formatTime(proj.bestTime)}
                          </span>
                          <span className="text-[9px] text-cyan-400/80 font-medium">Válido</span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 font-medium">
                          <XCircle className="w-3 h-3" /> Sin tiempo válido
                        </span>
                      )}
                    </td>

                    {/* Average Time */}
                    <td className="py-3.5 px-4 text-center font-mono">
                      {proj.averageTime ? (
                        <span className="text-slate-300 font-semibold">
                          {formatTime(proj.averageTime)}
                        </span>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>

                    {/* Completed count */}
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                        (proj.completedRunsCount || 0) > 0
                          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                        {(proj.completedRunsCount || 0) > 0 ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-slate-500" />
                        )}
                        {proj.completedRunsCount || 0}/3 pistas
                      </span>
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectProject(proj);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          // TABLE FOR RUBRIC CATEGORIES
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-800/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <th className="py-3 px-4 w-12 text-center">Pos</th>
                <th className="py-3 px-4">Proyecto & Equipo</th>
                {metrics.map((metric) => (
                  <th key={metric.id} className="py-3 px-3 text-center min-w-32">
                    {metric.name} <span className="whitespace-nowrap text-slate-500 font-normal">({Math.round(metric.weight * 100)}%)</span>
                  </th>
                ))}
                <th className="py-3 px-4 text-center bg-blue-950/20 text-blue-300 font-bold">
                  Nota Final (10-100)
                </th>
                <th className="py-3 px-4 text-center">Jurados</th>
                <th className="py-3 px-4 text-right">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtered.map((proj) => {
                const scoresList = Object.values(proj.scores || {});
                const count = scoresList.length;

                const getMetricAvg = (mId: string) => {
                  if (count === 0) return null;
                  const sum = scoresList.reduce((acc, curr) => acc + (curr.scores[mId] || 0), 0);
                  return (sum / count).toFixed(2);
                };

                return (
                  <tr
                    key={proj.id}
                    onClick={() => onSelectProject(proj)}
                    className="hover:bg-slate-800/50 transition-colors cursor-pointer group"
                  >
                    {/* Pos */}
                    <td className="py-3.5 px-4 text-center">
                      {getRankBadge(proj.rank)}
                    </td>

                    {/* Name & team */}
                    <td className="py-3.5 px-4 min-w-[240px]">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-semibold border border-slate-700">
                          {proj.code}
                        </span>
                        <span className="font-bold text-white group-hover:text-blue-400 transition-colors">
                          {proj.name}
                        </span>
                      </div>
                      <div className="text-slate-400 text-[11px] mt-0.5 truncate max-w-xs">
                        {proj.team} • <span className="text-slate-500">{proj.institution}</span>
                        {proj.standNumber && (
                          <span className="ml-2 text-indigo-400/90 font-medium">({proj.standNumber})</span>
                        )}
                      </div>
                    </td>

                    {metrics.map((metric) => {
                      const average = getMetricAvg(metric.id);
                      return (
                        <td key={metric.id} className="py-3.5 px-3 text-center font-mono text-slate-300">
                          {average ? <span className="font-medium">{average}</span> : <span className="text-slate-600">-</span>}
                        </td>
                      );
                    })}

                    {/* Total Final Score */}
                    <td className="py-3.5 px-4 text-center bg-blue-950/10">
                      {count > 0 ? (
                        <div className="inline-flex flex-col items-center">
                          <span className="font-mono font-black text-base text-white">
                            {formatScore(proj.averageScore)}
                          </span>
                          <span className="text-[9px] text-blue-400 font-medium">/ 100</span>
                        </div>
                      ) : (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                          Pendiente
                        </span>
                      )}
                    </td>

                    {/* Jurados count */}
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                        count > 0
                          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                          : 'bg-slate-800 text-slate-500 border-slate-700'
                      }`}>
                        {count} calificado(s)
                      </span>
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectProject(proj);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {filtered.length === 0 && (
          <div className="py-12 text-center text-slate-400 text-xs">
            No se encontraron proyectos con el término de búsqueda "{searchTerm}".
          </div>
        )}
      </div>
    </div>
  );
};
