import { Project, LineAttempt } from '../types.ts';

export function formatTime(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || seconds <= 0) {
    return '--:--.--';
  }
  const mins = Math.floor(seconds / 60);
  const remSecs = (seconds % 60).toFixed(2);
  const paddedSecs = parseFloat(remSecs) < 10 ? `0${remSecs}` : remSecs;
  if (mins > 0) {
    return `${mins}:${paddedSecs}`;
  }
  return `${remSecs}s`;
}

export function formatScore(score: number | null | undefined): string {
  if (score === null || score === undefined || score === 0) {
    return 'Pendiente';
  }
  return score.toFixed(2);
}

export function computeLineStats(attempts: LineAttempt[] = []) {
  const completedRuns = attempts.filter((a) => a.completedTrack && a.timeSeconds > 0);
  const validRunsWithTime = attempts.filter((a) => a.timeSeconds > 0);

  const bestTime =
    completedRuns.length > 0
      ? Math.min(...completedRuns.map((a) => a.timeSeconds))
      : null;

  const averageTime =
    completedRuns.length > 0
      ? Number((completedRuns.reduce((acc, curr) => acc + curr.timeSeconds, 0) / completedRuns.length).toFixed(3))
      : null;

  const allAttemptsAverage =
    validRunsWithTime.length > 0
      ? Number((validRunsWithTime.reduce((acc, curr) => acc + curr.timeSeconds, 0) / validRunsWithTime.length).toFixed(3))
      : null;

  const completedRunsCount = completedRuns.length;
  const hasCompletedTrack = completedRunsCount > 0;

  return {
    bestTime,
    averageTime,
    allAttemptsAverage,
    completedRunsCount,
    hasCompletedTrack,
  };
}

export function computeRubricStats(scores: Project['scores'] = {}) {
  const scoreValues = Object.values(scores);
  if (scoreValues.length === 0) {
    return { averageScore: 0, evaluationsCount: 0 };
  }

  const sum = scoreValues.reduce((acc, curr) => acc + curr.totalScore, 0);
  const averageScore = Number((sum / scoreValues.length).toFixed(2));

  return {
    averageScore,
    evaluationsCount: scoreValues.length,
  };
}

/**
 * Sorts and ranks projects according to their category rules
 */
export function rankProjects(projects: Project[], categoryId: string): (Project & { rank: number })[] {
  const filtered = projects.filter((p) => p.categoryId === categoryId);

  if (categoryId === 'linea') {
    // SEGUIDORES DE LÍNEA:
    // 1. Equipos que completaron la pista (hasCompletedTrack) van primero
    // 2. Menor tiempo es mejor (bestTime ascendente)
    // 3. Menor promedio de completados (averageTime ascendente)
    // 4. Mayor cantidad de intentos completados
    const sorted = [...filtered].sort((a, b) => {
      const aStats = computeLineStats(a.attempts);
      const bStats = computeLineStats(b.attempts);

      // Completed track priority
      if (aStats.hasCompletedTrack && !bStats.hasCompletedTrack) return -1;
      if (!aStats.hasCompletedTrack && bStats.hasCompletedTrack) return 1;

      // Both completed track at least once
      if (aStats.hasCompletedTrack && bStats.hasCompletedTrack) {
        const aBest = aStats.bestTime ?? 999999;
        const bBest = bStats.bestTime ?? 999999;
        if (Math.abs(aBest - bBest) > 0.001) {
          return aBest - bBest; // Menor tiempo gana
        }
        // Tie-breaker: Average completed time
        const aAvg = aStats.averageTime ?? 999999;
        const bAvg = bStats.averageTime ?? 999999;
        if (Math.abs(aAvg - bAvg) > 0.001) {
          return aAvg - bAvg;
        }
        // Tie-breaker: more completed runs
        return bStats.completedRunsCount - aStats.completedRunsCount;
      }

      // Neither completed track: order by attempts registered
      const aAttemptsCount = (a.attempts || []).filter((x) => x.timeSeconds > 0).length;
      const bAttemptsCount = (b.attempts || []).filter((x) => x.timeSeconds > 0).length;
      return bAttemptsCount - aAttemptsCount;
    });

    return sorted.map((p, idx) => ({ ...p, rank: idx + 1 }));
  }

  // RUBRIC CATEGORIES (Primaria y Bachillerato):
  // Sort by averageScore descending (5.0 is top)
  const sorted = [...filtered].sort((a, b) => {
    const aAvg = a.averageScore || 0;
    const bAvg = b.averageScore || 0;
    if (Math.abs(bAvg - aAvg) > 0.001) {
      return bAvg - aAvg;
    }
    // Tie-breaker: evaluations count
    return (b.evaluationsCount || 0) - (a.evaluationsCount || 0);
  });

  return sorted.map((p, idx) => ({ ...p, rank: idx + 1 }));
}
