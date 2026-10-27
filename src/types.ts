export type CategoryId = 'primaria' | 'bachillerato' | 'linea';

export interface CategoryInfo {
  id: CategoryId;
  name: string;
  shortName: string;
  description: string;
  icon: string;
  type: 'rubric' | 'timed';
}

export interface MetricDefinition {
  id: string;
  name: string;
  weight: number; // 0.25 (25%)
  description: string;
  min: number; // 1.0
  max: number; // 5.0
  guide: string[];
}

export interface ProjectScoreItem {
  jurorId: string;
  jurorName: string;
  scores: Record<string, number>; // metricId -> score (1.0 to 5.0)
  totalScore: number; // calculated 1.0 to 5.0
  feedback?: string;
  updatedAt: string;
}

export interface LineAttempt {
  attemptNumber: 1 | 2 | 3;
  timeSeconds: number; // in seconds (e.g. 14.32)
  completedTrack: boolean; // ¿Completó la pista? Sí / No
  penaltySeconds?: number;
  notes?: string;
  recordedAt?: string;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  team: string;
  institution: string;
  categoryId: CategoryId;
  description: string;
  members?: string[];
  standNumber?: string;
  imageUrl?: string;
  // For rubric categories (Primaria & Bachillerato)
  scores?: Record<string, ProjectScoreItem>; // jurorId -> ProjectScoreItem
  averageScore?: number; // 1.0 to 5.0
  evaluationsCount?: number;
  // For Line Follower category
  attempts?: LineAttempt[]; // up to 3 attempts
  bestTime?: number | null; // best valid time among completed runs
  averageTime?: number | null; // average of completed runs
  allAttemptsAverage?: number | null; // average of all attempts with time > 0
  completedRunsCount?: number; // count of attempts with completedTrack === true
  hasCompletedTrack?: boolean;
}

export interface UserAccount {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'jurado_primaria' | 'jurado_bachillerato' | 'cronometro_linea' | 'viewer';
  assignedCategory?: CategoryId | 'all';
  avatar?: string;
  badge: string;
}

export interface TournamentState {
  title: string;
  subtitle: string;
  status: 'active' | 'paused' | 'finished';
  activeCategory: CategoryId;
  projects: Project[];
  metrics: Record<'primaria' | 'bachillerato', MetricDefinition[]>;
  lastUpdated: string;
  activityLog: {
    id: string;
    timestamp: string;
    message: string;
    type: 'score' | 'line' | 'project' | 'status';
  }[];
}

export type WSMessage =
  | { type: 'INIT'; payload: TournamentState }
  | { type: 'STATE_UPDATED'; payload: TournamentState }
  | { type: 'SUBMIT_SCORE'; payload: { projectId: string; jurorId: string; jurorName: string; scores: Record<string, number>; feedback?: string } }
  | { type: 'SUBMIT_LINE_ATTEMPT'; payload: { projectId: string; attempt: LineAttempt } }
  | { type: 'UPDATE_EVENT_STATUS'; payload: { status: TournamentState['status'] } }
  | { type: 'PING' }
  | { type: 'PONG' }
  | { type: 'ERROR'; payload: { message: string } };
