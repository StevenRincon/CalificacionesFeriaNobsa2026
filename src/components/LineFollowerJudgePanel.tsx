import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Save, 
  Flag, 
  Gauge, 
  Trophy, 
  Zap,
  Sliders,
  ChevronRight,
  AlertTriangle,
  Search
} from 'lucide-react';
import { LineAttempt, Project, UserAccount } from '../types.ts';
import { formatTime, computeLineStats } from '../utils/formatters.ts';
import { soundFx } from '../utils/audio.ts';

interface LineFollowerJudgePanelProps {
  projects: Project[];
  currentUser: UserAccount;
  onSubmitLineAttempt: (projectId: string, attempt: LineAttempt) => Promise<void>;
}

export const LineFollowerJudgePanel: React.FC<LineFollowerJudgePanelProps> = ({
  projects,
  currentUser,
  onSubmitLineAttempt,
}) => {
  const lineProjects = projects.filter((p) => p.categoryId === 'linea');
  const [searchTerm, setSearchTerm] = useState('');
  const filteredLineProjects = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (!query) return lineProjects;
    return lineProjects.filter((project) => {
      const searchable = [
        project.name,
        project.team,
        ...(project.members || []),
      ].join(' ').toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return searchable.includes(query);
    });
  }, [lineProjects, searchTerm]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    lineProjects[0]?.id || ''
  );

  const selectedProject = lineProjects.find((p) => p.id === selectedProjectId);

  // Digital Stopwatch State
  const [timerRunning, setTimerRunning] = useState<boolean>(false);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const timerStartRef = useRef<number>(0);
  const timerRafRef = useRef<number | null>(null);

  useEffect(() => {
    if (timerRunning) {
      timerStartRef.current = performance.now() - elapsedMs;
      const update = () => {
        setElapsedMs(performance.now() - timerStartRef.current);
        timerRafRef.current = requestAnimationFrame(update);
      };
      timerRafRef.current = requestAnimationFrame(update);
    } else {
      if (timerRafRef.current) cancelAnimationFrame(timerRafRef.current);
    }
    return () => {
      if (timerRafRef.current) cancelAnimationFrame(timerRafRef.current);
    };
  }, [timerRunning]);

  const handleStartTimer = () => {
    soundFx.playStartBuzzer();
    setTimerRunning(true);
  };

  const handlePauseTimer = () => {
    soundFx.playLapOrFinish();
    setTimerRunning(false);
  };

  const handleResetTimer = () => {
    setTimerRunning(false);
    setElapsedMs(0);
    soundFx.playBeep(440, 0.05);
  };

  const getStopwatchSeconds = (): number => {
    const currentElapsedMs = timerRunning
      ? performance.now() - timerStartRef.current
      : elapsedMs;
    return Number((currentElapsedMs / 1000).toFixed(2));
  };

  const formatStopwatchDisplay = (ms: number) => {
    const totalSecs = ms / 1000;
    const mins = Math.floor(totalSecs / 60);
    const secs = Math.floor(totalSecs % 60);
    const hundredths = Math.floor((ms % 1000) / 10);
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    return `${pad(mins)}:${pad(secs)}.${pad(hundredths)}`;
  };

  // Local draft attempts state for the selected project
  const [draftAttempts, setDraftAttempts] = useState<LineAttempt[]>([
    { attemptNumber: 1, timeSeconds: 0, completedTrack: false, notes: '' },
    { attemptNumber: 2, timeSeconds: 0, completedTrack: false, notes: '' },
    { attemptNumber: 3, timeSeconds: 0, completedTrack: false, notes: '' },
  ]);
  const [savedSuccessAttempt, setSavedSuccessAttempt] = useState<number | null>(null);
  const [savingAttempt, setSavingAttempt] = useState<number | null>(null);
  const [saveError, setSaveError] = useState('');

  // Sync draft when project changes
  useEffect(() => {
    if (!selectedProject) return;
    const initial: LineAttempt[] = [1, 2, 3].map((num) => {
      const existing = selectedProject.attempts?.find((a) => a.attemptNumber === num);
      if (existing) {
        return { ...existing };
      }
      return {
        attemptNumber: num as 1 | 2 | 3,
        timeSeconds: 0,
        completedTrack: false,
        notes: '',
      };
    });
    setDraftAttempts(initial);
    setSavedSuccessAttempt(null);
  }, [selectedProjectId, selectedProject]);

  const handleAttemptChange = (
    attemptNum: 1 | 2 | 3,
    field: keyof LineAttempt,
    value: any
  ) => {
    setDraftAttempts((prev) =>
      prev.map((att) =>
        att.attemptNumber === attemptNum ? { ...att, [field]: value } : att
      )
    );
  };

  const applyStopwatchTimeToAttempt = (attemptNum: 1 | 2 | 3) => {
    const secs = getStopwatchSeconds();
    if (secs <= 0) return;
    handleAttemptChange(attemptNum, 'timeSeconds', secs);
    handleAttemptChange(attemptNum, 'completedTrack', true);
    soundFx.playBeep(800, 0.1);
  };

  const saveAttempt = async (attemptNum: 1 | 2 | 3) => {
    if (!selectedProject) return;
    const target = draftAttempts.find((a) => a.attemptNumber === attemptNum);
    if (!target) return;

    const timeSeconds = target.timeSeconds > 0 ? target.timeSeconds : getStopwatchSeconds();
    if (timeSeconds <= 0) {
      const error = 'Registra un tiempo o carga el tiempo del cronómetro antes de guardar.';
      setSaveError(error);
      console.error('[RoboEval] Intento no guardado: no hay un tiempo mayor que cero.', {
        projectId: selectedProject.id,
        attemptNumber: attemptNum,
        enteredTime: target.timeSeconds,
        stopwatchTime: getStopwatchSeconds(),
      });
      return;
    }

    const attemptToSave: LineAttempt = { ...target, timeSeconds };
    setDraftAttempts((current) => current.map((attempt) =>
      attempt.attemptNumber === attemptNum ? attemptToSave : attempt
    ));
    setSavingAttempt(attemptNum);
    setSaveError('');
    setSavedSuccessAttempt(null);
    try {
      console.info('[RoboEval] Guardando tiempo de Seguidores de Línea', {
        projectId: selectedProject.id,
        projectName: selectedProject.name,
        attemptNumber: attemptNum,
        timeSeconds: attemptToSave.timeSeconds,
        completedTrack: attemptToSave.completedTrack,
      });
      await onSubmitLineAttempt(selectedProject.id, attemptToSave);
      soundFx.playLapOrFinish();
      setSavedSuccessAttempt(attemptNum);
      setTimeout(() => setSavedSuccessAttempt(null), 2500);
    } catch (error) {
      console.error('[RoboEval] Error guardando intento de Seguidores de Línea', {
        projectId: selectedProject.id,
        attemptNumber: attemptNum,
        timeSeconds: attemptToSave.timeSeconds,
        error,
      });
      setSaveError(error instanceof Error ? error.message : 'No se pudo guardar el tiempo.');
    } finally {
      setSavingAttempt(null);
    }
  };

  const stats = selectedProject ? computeLineStats(selectedProject.attempts) : null;

  return (
    <div className="space-y-6">
      {/* Top Banner: Digital Stopwatch Widget */}
      <div className="cyber-card p-5 border border-cyan-400 glow-cyan">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-400/60 glow-cyan">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2 font-display text-glow-cyan">
                CRONÓMETRO DIGITAL OFICIAL (MILISEGUNDOS)
                <span className="text-[10px] font-mono bg-cyan-950 text-cyan-300 px-2 py-0.5 rounded-sm border border-cyan-400 font-bold">
                  JUEZ DE PISTA
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                // Medición de vuelta en vivo. Carga instantánea a Intento 1, 2 o 3 con un solo clic.
              </p>
            </div>
          </div>

          {/* Big Digital Display & Controls */}
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="px-6 py-2.5 rounded-sm bg-[#05060a] border-2 border-cyan-400 shadow-inner font-mono text-3xl sm:text-4xl font-black text-cyan-300 tracking-wider text-glow-cyan glow-cyan">
              {formatStopwatchDisplay(elapsedMs)}
            </div>

            <div className="flex items-center gap-2">
              {!timerRunning ? (
                <button
                  type="button"
                  onClick={handleStartTimer}
                  className="cyber-button-primary px-5 py-2.5 text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>INICIAR</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePauseTimer}
                  className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-mono font-black text-xs uppercase tracking-wider rounded-sm shadow-lg shadow-amber-400/30 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Pause className="w-4 h-4 fill-current" />
                  <span>DETENER</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleResetTimer}
                className="p-2.5 rounded-sm bg-[#11141d] hover:bg-slate-800 text-slate-300 hover:text-cyan-300 border border-cyan-500/40 transition-colors cursor-pointer"
                title="Reiniciar a 00:00.00"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Teams List & Attempt Management */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Line Follower Teams List */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col h-[520px] lg:h-[780px]">
          <div className="pb-3 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white flex items-center justify-between">
              <span>Robots en Competencia</span>
              <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-medium">
                {lineProjects.length} equipos
              </span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              3 intentos reglamentarios por equipo
            </p>
          </div>

          <label className="relative block mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400" />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar proyecto o participante"
              aria-label="Buscar robot por proyecto o participante"
              className="w-full min-h-11 pl-10 pr-3 rounded bg-slate-950 border border-slate-700 text-base sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
            />
          </label>

          <div className="flex-1 overflow-y-auto space-y-2 py-3 pr-1">
            {filteredLineProjects.map((proj) => {
              const isSelected = proj.id === selectedProjectId;
              const pStats = computeLineStats(proj.attempts);

              return (
                <button
                  key={proj.id}
                  onClick={() => setSelectedProjectId(proj.id)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                    isSelected
                      ? 'bg-cyan-600/20 border-cyan-500 shadow-md ring-1 ring-cyan-500/50'
                      : 'bg-slate-800/60 border-slate-700/70 hover:bg-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white leading-snug break-words">{proj.name}</p>
                    <p className="text-xs text-slate-400 break-words mt-1">
                      {proj.members?.length ? proj.members.join(', ') : proj.team}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 text-[10px]">
                      <span className="text-slate-400 font-mono">
                        Mejor: <strong className="text-cyan-300">{formatTime(pStats.bestTime)}</strong>
                      </span>
                      <span>•</span>
                      <span className="text-slate-400 font-mono">
                        Prom: <strong className="text-slate-300">{formatTime(pStats.averageTime)}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                      pStats.hasCompletedTrack
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}>
                      {pStats.completedRunsCount}/3 pistas
                    </span>
                  </div>
                </button>
              );
            })}
              {filteredLineProjects.length === 0 && (
                <p className="py-6 text-center text-sm text-slate-400">
                  {searchTerm ? 'No hay proyectos o participantes que coincidan.' : 'No hay proyectos inscritos en esta categoría.'}
                </p>
              )}
          </div>
        </div>

        {/* Right Column: Attempts Management */}
        <div className="lg:col-span-8 space-y-6">
          {selectedProject ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
              {/* Project Card Header */}
              <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/30">
                      {selectedProject.code}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      {selectedProject.standNumber || 'Zona de Pista'}
                    </span>
                  </div>
                  <h2 className="text-lg font-extrabold text-white mt-1">
                    {selectedProject.name}
                  </h2>
                  <p className="text-xs text-slate-300 font-medium">
                    {selectedProject.team} — <span className="text-slate-400">{selectedProject.institution}</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-2 line-clamp-2">
                    {selectedProject.description}
                  </p>
                </div>

                {/* Official Stats Card */}
                {stats && (
                  <div className="bg-slate-900/90 border border-slate-700 p-3.5 rounded-xl text-center min-w-[170px] flex-shrink-0">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                      Mejor Tiempo Oficial
                    </span>
                    <span className="text-2xl font-black text-cyan-300 font-mono leading-none block my-1">
                      {formatTime(stats.bestTime)}
                    </span>
                    <div className="text-[10px] text-slate-400 flex flex-col items-center gap-0.5 mt-1 border-t border-slate-800 pt-1">
                      <span>Promedio: <strong className="text-slate-200">{formatTime(stats.averageTime)}</strong></span>
                      <span className={stats.hasCompletedTrack ? 'text-emerald-400 font-semibold' : 'text-rose-400'}>
                        {stats.hasCompletedTrack ? '✓ Completó Pista' : '✗ Sin completar (DNF)'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Rules banner */}
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-200 flex items-start gap-2">
                <Flag className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>Reglamento Oficial:</strong> Se registran hasta 3 intentos por equipo. Para clasificar y ganar, el robot <strong>debe haber completado la pista</strong> en el menor tiempo posible. El promedio se calcula automáticamente sobre los intentos completados.
                </div>
              </div>

              {/* 3 Attempts Blocks */}
              <div className="space-y-4">
                {saveError && (
                  <p role="alert" className="rounded border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
                    {saveError}
                  </p>
                )}
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-cyan-400" />
                  Registro de Intentos Reglamentarios (1, 2 y 3)
                </h3>

                <div className="space-y-4">
                  {draftAttempts.map((att) => {
                    const isSuccess = savedSuccessAttempt === att.attemptNumber;

                    return (
                      <div
                        key={att.attemptNumber}
                        className="p-4 rounded-xl bg-slate-800/60 border border-slate-700 hover:border-slate-600 transition-colors"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-700/60">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-xs font-black">
                              #{att.attemptNumber}
                            </span>
                            <span className="text-sm font-bold text-white">
                              Intento Oficial {att.attemptNumber}
                            </span>
                            {att.recordedAt && (
                              <span className="text-[10px] text-slate-500">
                                (Última actualización: {new Date(att.recordedAt).toLocaleTimeString()})
                              </span>
                            )}
                          </div>

                          {/* Quick copy from stopwatch button */}
                          <button
                            type="button"
                            onClick={() => applyStopwatchTimeToAttempt(att.attemptNumber)}
                            className="text-xs px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-cyan-600 text-slate-200 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Clock className="w-3.5 h-3.5" />
                            <span>Cargar tiempo de cronómetro ({getStopwatchSeconds()}s)</span>
                          </button>
                        </div>

                        {/* Fields */}
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 mt-3 items-center">
                          
                          {/* Time in seconds */}
                          <div className="sm:col-span-4">
                            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                              Tiempo Registrado (Segundos)
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                min={0}
                                max={300}
                                step={0.01}
                                value={att.timeSeconds || ''}
                                onChange={(e) =>
                                  handleAttemptChange(
                                    att.attemptNumber,
                                    'timeSeconds',
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                placeholder="0.00"
                                className="w-full pl-3 pr-8 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm font-mono font-bold text-white focus:outline-none focus:border-cyan-400"
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400">
                                seg
                              </span>
                            </div>
                          </div>

                          {/* Completed Track Toggle: SÍ / NO (DNF) */}
                          <div className="sm:col-span-5">
                            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                              ¿Terminó la Pista Completa?
                            </label>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  handleAttemptChange(att.attemptNumber, 'completedTrack', true)
                                }
                                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                                  att.completedTrack
                                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-600/30'
                                    : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                                }`}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Sí (Completó)</span>
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  handleAttemptChange(att.attemptNumber, 'completedTrack', false)
                                }
                                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                                  !att.completedTrack
                                    ? 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-600/30'
                                    : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                                }`}
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>No (DNF)</span>
                              </button>
                            </div>
                          </div>

                          {/* Save Button for Attempt */}
                          <div className="sm:col-span-3 flex sm:justify-end pt-4 sm:pt-0">
                            <button
                              type="button"
                              onClick={() => saveAttempt(att.attemptNumber)}
                              disabled={savingAttempt === att.attemptNumber}
                              className={`w-full sm:w-auto px-4 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                savingAttempt === att.attemptNumber
                                  ? 'bg-slate-600 text-white'
                                  : isSuccess
                                  ? 'bg-emerald-600 text-white shadow-md'
                                  : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-600/20 active:scale-95'
                              }`}
                            >
                              {savingAttempt === att.attemptNumber ? (
                                <span>Guardando…</span>
                              ) : isSuccess ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>¡Guardado!</span>
                                </>
                              ) : (
                                <>
                                  <Save className="w-3.5 h-3.5" />
                                  <span>Guardar #{att.attemptNumber}</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Optional Referee Notes */}
                        <div className="mt-2.5">
                          <input
                            type="text"
                            value={att.notes || ''}
                            onChange={(e) =>
                              handleAttemptChange(att.attemptNumber, 'notes', e.target.value)
                            }
                            placeholder="Notas del juez de pista (ej. Salida en chicana, récord de vuelta, descalibración...)"
                            className="w-full px-3 py-1.5 bg-slate-900/80 border border-slate-700 rounded-lg text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-20 text-slate-500">
              Selecciona un robot de seguidores de línea para registrar sus tiempos.
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
