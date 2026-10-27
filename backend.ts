import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import http from 'http';
import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { Collection, Db, MongoClient } from 'mongodb';
import { INITIAL_TOURNAMENT_STATE } from './src/data/defaultData.ts';
import { CategoryId, Project, ProjectScoreItem, TournamentState, UserAccount, WSMessage, LineAttempt } from './src/types.ts';
import { computeLineStats, computeRubricStats } from './src/utils/formatters.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;
const isVercel = Boolean(process.env.VERCEL);
const isProduction = process.env.NODE_ENV === 'production' || isVercel;
const SESSION_COOKIE = 'roboeval_session';
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const scrypt = promisify(scryptCallback);

const CATEGORY_VALUES: Record<string, CategoryId> = {
  seguidores: 'linea',
  automatizacion: 'bachillerato',
  educativos: 'bachillerato',
  'seguidores de linea': 'linea',
  'proyecto de automatizacion electronica': 'bachillerato',
  'proyectos educativos en robotica': 'bachillerato',
};

interface RegistrationDocument {
  _id: { toString(): string };
  code?: unknown;
  category?: unknown;
  categoryName?: unknown;
  projectTitle?: unknown;
  team?: unknown;
  teamName?: unknown;
  teamTitle?: unknown;
  institution?: unknown;
  institutionName?: unknown;
  schoolName?: unknown;
  description?: unknown;
  projectDescription?: unknown;
  members?: unknown;
  standNumber?: unknown;
  imageUrl?: unknown;
  [key: string]: unknown;
}

interface StoredAccount extends Omit<UserAccount, 'id'> {
  _id: string;
  usernameKey: string;
  passwordSalt: string;
  passwordHash: string;
}

interface SessionDocument {
  _id: string;
  accountId: string;
  expiresAt: Date;
}

interface EvaluationDocument {
  _id: string;
  categoryId: CategoryId;
  scores?: Project['scores'];
  attempts?: LineAttempt[];
}

interface TournamentMetadata {
  _id: 'tournament';
  title: string;
  subtitle: string;
  status: TournamentState['status'];
  activeCategory: CategoryId;
  lastUpdated: string;
  activityLog: TournamentState['activityLog'];
}

interface AuthenticatedRequest extends Request {
  account?: StoredAccount;
}

type DatabaseFailureStage = 'configuration' | 'uri' | 'connection' | 'initialization' | 'query';

class DatabaseDiagnosticError extends Error {
  constructor(
    readonly stage: DatabaseFailureStage,
    readonly code: string,
    readonly guidance: string
  ) {
    super(`MongoDB failure during ${stage}: ${code}`);
    this.name = 'DatabaseDiagnosticError';
  }
}

const globalMongo = globalThis as typeof globalThis & {
  roboevalMongoClientPromise?: Promise<MongoClient>;
  roboevalDatabaseReady?: Promise<Db>;
};

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
let wss: WebSocketServer;

function logError(context: string, error: unknown) {
  if (error instanceof DatabaseDiagnosticError) {
    console.error(`${context}: stage=${error.stage}, code=${error.code}`);
    return;
  }
  const name = error instanceof Error ? error.name : 'UnknownError';
  const code = error && typeof error === 'object' && 'code' in error
    ? `, code=${String(error.code)}`
    : '';
  console.error(`${context}: name=${name}${code}`);
}

function classifyMongoFailure(
  error: unknown,
  fallbackStage: DatabaseFailureStage
): DatabaseDiagnosticError {
  if (error instanceof DatabaseDiagnosticError) return error;
  const mongoError = error && typeof error === 'object' ? error as { name?: string; code?: string | number } : {};
  const code = mongoError.code === undefined ? mongoError.name || 'UNKNOWN' : String(mongoError.code);
  if (mongoError.name === 'MongoParseError' || code === 'ERR_INVALID_URL') {
    return new DatabaseDiagnosticError(
      'uri',
      code,
      'MONGODB_URI no tiene un formato válido. Usa la URI mongodb+srv:// de Atlas y codifica caracteres especiales en usuario y contraseña.'
    );
  }
  if (code === '18' || code === 'AuthenticationFailed') {
    return new DatabaseDiagnosticError(
      fallbackStage,
      code,
      'Atlas rechazó la autenticación. Verifica usuario y contraseña de base de datos, caracteres especiales codificados y authSource.'
    );
  }
  if (code === '13' || code === 'Unauthorized') {
    return new DatabaseDiagnosticError(
      fallbackStage,
      code,
      'La conexión llegó a MongoDB, pero el usuario no tiene permisos suficientes. Asigna el rol readWrite sobre la base configurada.'
    );
  }
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return new DatabaseDiagnosticError(
      'connection',
      code,
      'No se pudo resolver el host de MongoDB. Revisa el host/SRV de MONGODB_URI y la configuración DNS.'
    );
  }
  if (code === 'ECONNREFUSED' || code === 'ETIMEDOUT' || code === 'ECONNRESET' || code === 'MongoServerSelectionError') {
    return new DatabaseDiagnosticError(
      'connection',
      code,
      'No se pudo alcanzar el clúster. Verifica que esté activo y que Network Access de Atlas permita conexiones desde Vercel o desde tu IP local.'
    );
  }
  if (code === 'MongoNetworkError') {
    return new DatabaseDiagnosticError(
      'connection',
      code,
      'Falló la comunicación con MongoDB. Revisa el host de la URI, DNS, el estado del clúster y Network Access.'
    );
  }
  if (fallbackStage === 'initialization') {
    return new DatabaseDiagnosticError(
      'initialization',
      code,
      'La conexión se abrió, pero no se pudo preparar la base. Revisa que la base exista y que el usuario tenga permiso readWrite para crear índices y guardar documentos.'
    );
  }
  return new DatabaseDiagnosticError(
    fallbackStage,
    code,
    'Revisa los Runtime Logs de Vercel para identificar el comando de MongoDB que falló y los permisos del usuario.'
  );
}

function getMongoClient() {
  if (!process.env.MONGODB_URI) {
    throw new DatabaseDiagnosticError(
      'configuration',
      'MONGODB_URI_MISSING',
      'No está definida la variable MONGODB_URI en este entorno. Añádela en Environment Variables de Vercel o en el archivo .env local y vuelve a desplegar/reiniciar.'
    );
  }
  if (!globalMongo.roboevalMongoClientPromise) {
    try {
      const client = new MongoClient(process.env.MONGODB_URI);
      globalMongo.roboevalMongoClientPromise = client.connect().then(() => client).catch((error: unknown) => {
        globalMongo.roboevalMongoClientPromise = undefined;
        throw classifyMongoFailure(error, 'connection');
      });
    } catch (error) {
      throw classifyMongoFailure(error, 'uri');
    }
  }
  return globalMongo.roboevalMongoClientPromise;
}

async function getDatabase() {
  if (!globalMongo.roboevalDatabaseReady) {
    globalMongo.roboevalDatabaseReady = getMongoClient()
      .then(async (client) => {
        const database = process.env.MONGODB_DB
          ? client.db(process.env.MONGODB_DB)
          : client.db();
        try {
          await initializeCollections(database);
        } catch (error) {
          throw classifyMongoFailure(error, 'initialization');
        }
        return database;
      })
      .catch((error: unknown) => {
        globalMongo.roboevalDatabaseReady = undefined;
        throw error;
      });
  }
  return globalMongo.roboevalDatabaseReady;
}

function collection<T extends object>(database: Db, name: string) {
  return database.collection<T>(name);
}

async function initializeCollections(database: Db) {
  const accounts = collection<StoredAccount>(database, 'roboeval_accounts');
  const sessions = collection<SessionDocument>(database, 'roboeval_sessions');
  await Promise.all([
    accounts.createIndex({ usernameKey: 1 }, { unique: true }),
    sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ]);
  const username = process.env.ADMIN_USERNAME || 'AlcaldiaNobsa';
  const password = process.env.ADMIN_PASSWORD || 'T1cN0b54';
  const usernameKey = username.toLowerCase();
  const existingAdmin = await accounts.findOne({ usernameKey });
  if (!existingAdmin) {
    const credentials = await hashPassword(password);
    await accounts.insertOne({
      _id: 'user_admin',
      username,
      usernameKey,
      name: 'Administrador de RoboEval',
      role: 'admin',
      assignedCategory: 'all',
      badge: 'Administrador Maestro',
      passwordSalt: credentials.salt,
      passwordHash: credentials.hash,
    });
  }

  const metadata = collection<TournamentMetadata>(database, 'roboeval_state');
  const defaults = INITIAL_TOURNAMENT_STATE;
  await metadata.updateOne(
    { _id: 'tournament' },
    {
      $setOnInsert: {
        title: defaults.title,
        subtitle: defaults.subtitle,
        status: defaults.status,
        activeCategory: defaults.activeCategory,
        lastUpdated: new Date().toISOString(),
        activityLog: [],
      },
    },
    { upsert: true }
  );
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function publicAccount(account: StoredAccount): UserAccount {
  const { _id, usernameKey: _usernameKey, passwordSalt: _salt, passwordHash: _hash, ...safeAccount } = account;
  if (account.role === 'jurado_primaria') {
    return { ...safeAccount, role: 'jurado_bachillerato', assignedCategory: 'bachillerato', id: _id };
  }
  return { ...safeAccount, id: _id };
}

async function hashPassword(password: string, salt = randomBytes(16).toString('hex')) {
  const hash = (await scrypt(password, salt, 64)) as Buffer;
  return { salt, hash: hash.toString('hex') };
}

async function createStoredAccount(
  account: Omit<UserAccount, 'id'> & { id?: string },
  password: string
): Promise<StoredAccount> {
  const { salt, hash } = await hashPassword(password);
  const id = account.id || randomUUID();
  const { id: _id, ...accountFields } = account;
  return {
    ...accountFields,
    _id: id,
    usernameKey: account.username.toLowerCase(),
    passwordSalt: salt,
    passwordHash: hash,
  };
}

async function verifyPassword(account: StoredAccount, password: string) {
  const { hash } = await hashPassword(password, account.passwordSalt);
  const expected = Buffer.from(account.passwordHash, 'hex');
  const actual = Buffer.from(hash, 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function cookieValue(cookieHeader: string | undefined, name: string) {
  const entry = cookieHeader?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  if (!entry) return undefined;
  try {
    return decodeURIComponent(entry.slice(name.length + 1));
  } catch {
    return undefined;
  }
}

function setSessionCookie(res: Response, token: string) {
  const secure = isProduction ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_SECONDS}${secure}`
  );
}

function clearSessionCookie(res: Response) {
  const secure = isProduction ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`);
}

async function getAccountFromCookie(cookieHeader: string | undefined, database: Db) {
  const token = cookieValue(cookieHeader, SESSION_COOKIE);
  if (!token) return undefined;
  const sessions = collection<SessionDocument>(database, 'roboeval_sessions');
  const session = await sessions.findOne({ _id: hashToken(token), expiresAt: { $gt: new Date() } });
  if (!session) return undefined;
  return (await collection<StoredAccount>(database, 'roboeval_accounts').findOne({ _id: session.accountId })) || undefined;
}

function asString(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function normalizeCategoryValue(value: unknown): string {
  return typeof value === 'string'
    ? value.trim().toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    : '';
}

function categoryFromFields(category: unknown, categoryName: unknown): CategoryId | undefined {
  return CATEGORY_VALUES[normalizeCategoryValue(category)]
    || CATEGORY_VALUES[normalizeCategoryValue(categoryName)];
}

function categoryFromRegistration(registration: RegistrationDocument): CategoryId | undefined {
  return categoryFromFields(registration.category, registration.categoryName);
}

function registrationParticipants(registration: RegistrationDocument): string[] {
  const names = new Set<string>();
  const participantFields = [
    'members',
    'participants',
    'participantNames',
    'studentNames',
    'teamMembers',
    'students',
    'integrantes',
  ];
  const nameFields = ['name', 'fullName', 'studentName', 'memberName', 'participantName', 'nombre'];

  for (const field of participantFields) {
    const value = registration[field];
    if (!Array.isArray(value)) continue;
    for (const participant of value) {
      if (typeof participant === 'string' && participant.trim()) {
        names.add(participant.trim());
      } else if (participant && typeof participant === 'object') {
        const record = participant as Record<string, unknown>;
        const explicitName = nameFields
          .map((key) => record[key])
          .find((candidate): candidate is string => typeof candidate === 'string' && Boolean(candidate.trim()));
        const firstName = typeof record.firstName === 'string' ? record.firstName.trim() : '';
        const lastName = typeof record.lastName === 'string' ? record.lastName.trim() : '';
        const name = explicitName?.trim() || [firstName, lastName].filter(Boolean).join(' ');
        if (name) names.add(name);
      }
    }
  }

  for (const field of ['participantName', 'studentName', 'memberName']) {
    const value = registration[field];
    if (typeof value === 'string' && value.trim()) names.add(value.trim());
  }

  return [...names];
}

function mapRegistration(registration: RegistrationDocument): Project | undefined {
  const categoryId = categoryFromRegistration(registration);
  if (!categoryId) return undefined;
  const id = registration._id.toString();
  return {
    id,
    code: asString(registration.code, id),
    name: asString(registration.projectTitle, 'Proyecto sin título'),
    team: asString(registration.teamName, asString(registration.teamTitle, asString(registration.team, 'Equipo participante'))),
    institution: asString(registration.institutionName, asString(registration.schoolName, asString(registration.institution, 'Institución educativa'))),
    categoryId,
    description: asString(registration.projectDescription, asString(registration.description, '')),
    members: registrationParticipants(registration),
    standNumber: typeof registration.standNumber === 'string' ? registration.standNumber : undefined,
    imageUrl: typeof registration.imageUrl === 'string' ? registration.imageUrl : undefined,
    scores: {},
    averageScore: 0,
    evaluationsCount: 0,
    attempts: categoryId === 'linea'
      ? [
          { attemptNumber: 1, timeSeconds: 0, completedTrack: false },
          { attemptNumber: 2, timeSeconds: 0, completedTrack: false },
          { attemptNumber: 3, timeSeconds: 0, completedTrack: false },
        ]
      : undefined,
    bestTime: null,
    averageTime: null,
    allAttemptsAverage: null,
    completedRunsCount: 0,
    hasCompletedTrack: false,
  };
}

function getCollections(database: Db) {
  return {
    registrations: collection<RegistrationDocument>(database, 'registrations'),
    evaluations: collection<EvaluationDocument>(database, 'roboeval_evaluations'),
    accounts: collection<StoredAccount>(database, 'roboeval_accounts'),
    sessions: collection<SessionDocument>(database, 'roboeval_sessions'),
    metadata: collection<TournamentMetadata>(database, 'roboeval_state'),
  };
}

async function loadProjects(database: Db): Promise<Project[]> {
  const collections = getCollections(database);
  const registrations = await collections.registrations
    .find({})
    .sort({ code: 1 })
    .toArray();
  const projects = registrations
    .map(mapRegistration)
    .filter((project): project is Project => Boolean(project));
  const projectIds = projects.map((project) => project.id);
  const evaluations = projectIds.length
    ? await collections.evaluations.find({ _id: { $in: projectIds } }).toArray()
    : [];
  const evaluationById = new Map(evaluations.map((evaluation) => [evaluation._id, evaluation]));

  for (const project of projects) {
    const evaluation = evaluationById.get(project.id);
    if (!evaluation) continue;
    if (project.categoryId === 'linea') {
      project.attempts = evaluation.attempts || project.attempts;
      const stats = computeLineStats(project.attempts || []);
      project.bestTime = stats.bestTime;
      project.averageTime = stats.averageTime;
      project.allAttemptsAverage = stats.allAttemptsAverage;
      project.completedRunsCount = stats.completedRunsCount;
      project.hasCompletedTrack = stats.hasCompletedTrack;
    } else {
      project.scores = normalizeStoredRubricScores(evaluation.scores || {});
      const stats = computeRubricStats(project.scores);
      project.averageScore = stats.averageScore;
      project.evaluationsCount = stats.evaluationsCount;
    }
  }

  return projects;
}

function normalizeStoredRubricScores(scores: Project['scores']): Project['scores'] {
  if (!scores) return {};
  const metricWeights: Record<string, number> = {
    m1_innovacion: 0.30,
    m2_estetica: 0.20,
    m3_impacto: 0.15,
    m4_poster: 0.10,
    m5_sustentacion: 0.25,
  };

  const upgraded: Record<string, ProjectScoreItem> = {};
  for (const [jurorId, evaluation] of Object.entries(scores)) {
    const oldScores = evaluation.scores;
    const hasLegacyRubric = ['m2_tecnica', 'm3_sustentacion', 'm4_impacto']
      .some((metricId) => Object.hasOwn(oldScores, metricId));
    if (!hasLegacyRubric) {
      upgraded[jurorId] = evaluation;
      continue;
    }
    const scoreToNewScale = (value: number | undefined) =>
      value === undefined ? 70 : Math.max(10, Math.min(100, Math.round(value * 20)));
    const newScores: Record<string, number> = {
      m1_innovacion: scoreToNewScale(oldScores.m1_innovacion),
      m2_estetica: 70,
      m3_impacto: scoreToNewScale(oldScores.m4_impacto),
      m4_poster: 70,
      m5_sustentacion: scoreToNewScale(oldScores.m3_sustentacion),
    };
    const totalScore = Number(Object.entries(metricWeights)
      .reduce((total, [metricId, weight]) => total + newScores[metricId] * weight, 0)
      .toFixed(2));
    upgraded[jurorId] = {
      ...evaluation,
      scores: newScores,
      totalScore,
    };
  }
  return upgraded;
}

async function loadTournamentState(database: Db): Promise<TournamentState> {
  const collections = getCollections(database);
  const [projects, metadata] = await Promise.all([
    loadProjects(database),
    collections.metadata.findOne({ _id: 'tournament' }),
  ]);
  const defaults = INITIAL_TOURNAMENT_STATE;
  return {
    title: metadata?.title || defaults.title,
    subtitle: metadata?.subtitle || defaults.subtitle,
    status: metadata?.status || defaults.status,
    activeCategory: metadata?.activeCategory === 'primaria'
      ? 'bachillerato'
      : metadata?.activeCategory || defaults.activeCategory,
    projects,
    metrics: defaults.metrics,
    lastUpdated: metadata?.lastUpdated || new Date(0).toISOString(),
    activityLog: metadata?.activityLog || [],
  };
}

async function recordActivity(
  database: Db,
  type: TournamentState['activityLog'][number]['type'],
  message: string,
  updates: Partial<Pick<TournamentMetadata, 'status' | 'activeCategory'>> = {}
) {
  const now = new Date().toISOString();
  const activity = { id: randomUUID(), timestamp: now, message, type };
  await collection<TournamentMetadata>(database, 'roboeval_state').updateOne(
    { _id: 'tournament' },
    {
      $set: { ...updates, lastUpdated: now },
      $push: { activityLog: { $each: [activity], $position: 0, $slice: 50 } },
    },
    { upsert: true }
  );
}

function canWrite(account: StoredAccount, message: WSMessage, state: TournamentState) {
  if (message.type === 'PING') return true;
  if (message.type === 'SUBMIT_SCORE') {
    const project = state.projects.find((item) => item.id === message.payload.projectId);
    if (!project || (project.categoryId !== 'primaria' && project.categoryId !== 'bachillerato')) return false;
    const scores = message.payload.scores;
    const metrics = state.metrics[project.categoryId];
    const validScores =
      scores !== null &&
      typeof scores === 'object' &&
      !Array.isArray(scores) &&
      Object.keys(scores).length === metrics.length &&
      metrics.every((metric) =>
        Number.isFinite(scores[metric.id]) &&
        Number.isInteger(scores[metric.id]) &&
        scores[metric.id] >= metric.min &&
        scores[metric.id] <= metric.max
      );
    const validFeedback = message.payload.feedback === undefined ||
      (typeof message.payload.feedback === 'string' && message.payload.feedback.length <= 2000);
    const hasCategoryAccess = account.role === `jurado_${project.categoryId}` ||
      (project.categoryId === 'bachillerato' && account.role === 'jurado_primaria');
    return hasCategoryAccess && validScores && validFeedback;
  }
  if (message.type === 'SUBMIT_LINE_ATTEMPT') {
    const project = state.projects.find((item) => item.id === message.payload.projectId);
    const attempt = message.payload.attempt;
    const validAttempt = attempt &&
      [1, 2, 3].includes(attempt.attemptNumber) &&
      Number.isFinite(attempt.timeSeconds) &&
      attempt.timeSeconds >= 0 &&
      typeof attempt.completedTrack === 'boolean' &&
      (attempt.penaltySeconds === undefined || (Number.isFinite(attempt.penaltySeconds) && attempt.penaltySeconds >= 0)) &&
      (attempt.notes === undefined || (typeof attempt.notes === 'string' && attempt.notes.length <= 500));
    return account.role === 'cronometro_linea' && project?.categoryId === 'linea' && Boolean(validAttempt);
  }
  return message.type === 'UPDATE_EVENT_STATUS' &&
    account.role === 'admin' &&
    ['active', 'paused', 'finished'].includes(message.payload.status);
}

function broadcast(message: WSMessage) {
  const data = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(data);
  });
}

let changeStream: ReturnType<Collection<TournamentMetadata>['watch']> | undefined;

async function startChangeStream(database: Db) {
  if (changeStream) return;
  const stream = collection<TournamentMetadata>(database, 'roboeval_state').watch();
  changeStream = stream;
  stream.on('change', () => {
    void loadTournamentState(database)
      .then((state) => broadcast({ type: 'STATE_UPDATED', payload: state }))
      .catch((error: unknown) => logError('MongoDB change stream state refresh failed', error));
  });
  stream.on('error', (error) => {
    logError('MongoDB change stream failed', error);
    if (changeStream === stream) changeStream = undefined;
    void stream.close().catch((closeError: unknown) => logError('Could not close MongoDB change stream', closeError));
  });
}

async function stopChangeStreamIfIdle() {
  if (wss.clients.size !== 0 || !changeStream) return;
  const stream = changeStream;
  changeStream = undefined;
  await stream.close();
}

async function handleWsMessage(message: WSMessage, account: StoredAccount | undefined, database: Db, ws?: WebSocket): Promise<boolean> {
  if (message.type === 'PING') {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'PONG' }));
    return true;
  }
  if (!account) {
    ws?.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Inicia sesión para evaluar.' } }));
    return false;
  }
  const state = await loadTournamentState(database);
  if (!canWrite(account, message, state)) {
    ws?.send(JSON.stringify({ type: 'ERROR', payload: { message: 'No tienes permisos para esta acción o los datos no son válidos.' } }));
    return false;
  }

  const collections = getCollections(database);
  if (message.type === 'SUBMIT_SCORE') {
    const project = state.projects.find((item) => item.id === message.payload.projectId);
    if (!project || (project.categoryId !== 'primaria' && project.categoryId !== 'bachillerato')) return false;
    const metricKeys = Object.keys(message.payload.scores);
    const metrics = state.metrics[project.categoryId];
    const total = Number(metrics.reduce(
      (sum, metric) => sum + message.payload.scores[metric.id] * metric.weight,
      0
    ).toFixed(2));
    const evaluation = {
      jurorId: account._id,
      jurorName: account.name,
      scores: message.payload.scores,
      totalScore: total,
      feedback: message.payload.feedback,
      updatedAt: new Date().toISOString(),
    };
    await collections.evaluations.updateOne(
      { _id: project.id },
      { $set: { categoryId: project.categoryId, [`scores.${account._id}`]: evaluation } },
      { upsert: true }
    );
    await recordActivity(
      database,
      'score',
      `${account.name} calificó a "${project.name}" (${project.code}) con ${total.toFixed(2)}/100`
    );
  } else if (message.type === 'SUBMIT_LINE_ATTEMPT') {
    const project = state.projects.find((item) => item.id === message.payload.projectId);
    if (!project || project.categoryId !== 'linea') return false;
    const attempts = [...(project.attempts || [])];
    const attempt: LineAttempt = { ...message.payload.attempt, recordedAt: new Date().toISOString() };
    const existingIndex = attempts.findIndex((item) => item.attemptNumber === attempt.attemptNumber);
    if (existingIndex < 0) attempts.push(attempt);
    else attempts[existingIndex] = attempt;
    attempts.sort((first, second) => first.attemptNumber - second.attemptNumber);
    await collections.evaluations.updateOne(
      { _id: project.id },
      { $set: { categoryId: project.categoryId, attempts } },
      { upsert: true }
    );
    const status = attempt.completedTrack
      ? `¡Pista completada en ${attempt.timeSeconds.toFixed(2)}s!`
      : `DNF (${attempt.timeSeconds > 0 ? `${attempt.timeSeconds.toFixed(2)}s` : '0s'})`;
    await recordActivity(database, 'line', `Intento #${attempt.attemptNumber} registrado para "${project.name}" por ${account.name}: ${status}`);
  } else if (message.type === 'UPDATE_EVENT_STATUS') {
    await recordActivity(database, 'status', `Estado del evento cambiado a: ${message.payload.status}`, { status: message.payload.status });
  }

  const updatedState = await loadTournamentState(database);
  broadcast({ type: 'STATE_UPDATED', payload: updatedState });
  return true;
}

export const app = express();
const server = http.createServer(app);
wss = new WebSocketServer({ server, path: '/api/ws' });

if (isProduction) {
  app.use(express.static(path.join(__dirname, 'dist')));
}

app.use(express.json({ limit: '1mb' }));

app.get('/api/health', async (_req: Request, res: Response) => {
  const uriConfigured = Boolean(process.env.MONGODB_URI);
  const databaseConfigured = Boolean(process.env.MONGODB_DB || process.env.MONGODB_URI);
  let stage: DatabaseFailureStage = 'connection';
  try {
    const database = await getDatabase();
    await database.command({ ping: 1 });
    stage = 'query';
    const registrationsCollectionExists = await database.listCollections(
      { name: 'registrations' },
      { nameOnly: true }
    ).hasNext();
    const registrations = collection<RegistrationDocument>(database, 'registrations');
    const [registrationCount, categoryGroups] = registrationsCollectionExists
      ? await Promise.all([
          registrations.countDocuments(),
          registrations.aggregate<{
            _id: { category: unknown; categoryName: unknown };
            count: number;
          }>([
            {
              $group: {
                _id: { category: '$category', categoryName: '$categoryName' },
                count: { $sum: 1 },
              },
            },
          ]).toArray(),
        ])
      : [0, []];
    const projectCounts: Record<CategoryId, number> = {
      primaria: 0,
      bachillerato: 0,
      linea: 0,
    };
    let unrecognizedCategoryCount = 0;
    for (const group of categoryGroups) {
      const categoryId = categoryFromFields(group._id.category, group._id.categoryName);
      if (categoryId) projectCounts[categoryId] += group.count;
      else unrecognizedCategoryCount += group.count;
    }
    res.json({
      ok: true,
      checks: {
        uriConfigured,
        databaseConfigured,
        connection: 'ok',
        databaseAccess: 'ok',
        registrationsCollectionExists,
        registrationsReadable: registrationsCollectionExists && registrationCount > 0,
      },
      source: {
        databaseName: database.databaseName,
        collectionName: 'registrations',
        registrationCount,
        recognizedProjectCounts: projectCounts,
        unrecognizedCategoryCount,
      },
      note: !registrationsCollectionExists
        ? 'La conexión funciona, pero no existe la colección registrations en la base seleccionada.'
        : registrationCount === 0
        ? 'La colección registrations existe, pero no contiene documentos.'
        : unrecognizedCategoryCount > 0
        ? 'La colección contiene documentos, pero algunas categorías no coinciden con las categorías configuradas.'
        : 'MongoDB y la colección de inscripciones responden correctamente.',
    });
  } catch (error) {
    const diagnostic = classifyMongoFailure(error, stage);
    logError('Database health check failed', diagnostic);
    res.status(503).json({
      ok: false,
      checks: {
        uriConfigured,
        databaseConfigured,
        connection: diagnostic.stage === 'connection' ? 'failed' : 'not_checked',
        databaseAccess: diagnostic.stage === 'initialization' || diagnostic.stage === 'query' ? 'failed' : 'not_checked',
        registrationsReadable: 'not_checked',
      },
      diagnostic: {
        stage: diagnostic.stage,
        code: diagnostic.code,
        message: diagnostic.guidance,
      },
    });
  }
});

app.use(async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await getDatabase();
    next();
  } catch (error) {
    const diagnostic = classifyMongoFailure(error, 'connection');
    logError('MongoDB connection or initialization failed', diagnostic);
    res.status(503).json({
      error: diagnostic.guidance,
      diagnostic: { stage: diagnostic.stage, code: diagnostic.code },
    });
  }
});

wss.on('connection', (ws, request) => {
  const databasePromise = (async () => {
    const database = await getDatabase();
    await startChangeStream(database);
    return database;
  })();

  ws.on('message', (raw) => {
    void (async () => {
      try {
        const database = await databasePromise;
        const currentAccount = await getAccountFromCookie(request.headers.cookie, database);
        const message = JSON.parse(raw.toString()) as WSMessage;
        await handleWsMessage(message, currentAccount, database, ws);
      } catch (error) {
        logError('Error processing WebSocket message', error);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'No se pudo procesar la solicitud.' } }));
        }
      }
    })();
  });
  ws.on('close', () => {
    void stopChangeStreamIfIdle().catch((error: unknown) => logError('Could not stop MongoDB change stream', error));
  });

  void databasePromise
    .then(async (database) => {
      if (wss.clients.size === 0) await stopChangeStreamIfIdle();
      const state = await loadTournamentState(database);
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'INIT', payload: state }));
    })
    .catch((error: unknown) => {
      logError('WebSocket initialization failed', error);
      if (ws.readyState === WebSocket.OPEN) ws.close(1011, 'Database unavailable');
    });
});

app.get('/api/state', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await loadTournamentState(await getDatabase()));
  } catch (error) {
    next(error);
  }
});

app.get('/api/projects', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const allProjects = await loadProjects(await getDatabase());
    const requestedCategory = req.query.category;
    if (
      requestedCategory !== undefined &&
      requestedCategory !== 'primaria' &&
      requestedCategory !== 'bachillerato' &&
      requestedCategory !== 'linea'
    ) {
      res.status(400).json({ error: 'La categoría solicitada no es válida.' });
      return;
    }
    const projects = requestedCategory
      ? allProjects.filter((project) => project.categoryId === requestedCategory)
      : allProjects;
    res.json({
      projects,
      count: projects.length,
      categories: {
        automatizacion: allProjects.filter((project) => project.categoryId === 'bachillerato').length,
        seguidores: allProjects.filter((project) => project.categoryId === 'linea').length,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ip = req.ip || 'unknown';
    const attempts = loginAttempts.get(ip);
    if (attempts && attempts.resetAt > Date.now() && attempts.count >= 10) {
      res.status(429).json({ error: 'Demasiados intentos. Espera 15 minutos e inténtalo de nuevo.' });
      return;
    }
    const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const accounts = collection<StoredAccount>(await getDatabase(), 'roboeval_accounts');
    const account = await accounts.findOne({ usernameKey: username.toLowerCase() });
    if (!account || !(await verifyPassword(account, password))) {
      const current = attempts?.resetAt && attempts.resetAt > Date.now()
        ? attempts
        : { count: 0, resetAt: Date.now() + 15 * 60 * 1000 };
      current.count += 1;
      loginAttempts.set(ip, current);
      res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
      return;
    }
    loginAttempts.delete(ip);
    const token = randomBytes(32).toString('hex');
    await collection<SessionDocument>(await getDatabase(), 'roboeval_sessions').insertOne({
      _id: hashToken(token),
      accountId: account._id,
      expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000),
    });
    setSessionCookie(res, token);
    res.json({ user: publicAccount(account) });
  } catch (error) {
    next(error);
  }
});

async function getRequestAccount(req: Request) {
  return getAccountFromCookie(req.headers.cookie, await getDatabase());
}

function requireAccount(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  void getRequestAccount(req)
    .then((account) => {
      if (!account) {
        res.status(401).json({ error: 'Inicia sesión para continuar.' });
        return;
      }
      req.account = account;
      next();
    })
    .catch(next);
}

function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (req.account?.role !== 'admin') {
    res.status(403).json({ error: 'Esta acción requiere permisos de administrador.' });
    return;
  }
  next();
}

app.get('/api/auth/me', requireAccount, (req: AuthenticatedRequest, res: Response) => {
  res.json({ user: publicAccount(req.account!) });
});

app.post('/api/auth/logout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = cookieValue(req.headers.cookie, SESSION_COOKIE);
    if (token) {
      await collection<SessionDocument>(await getDatabase(), 'roboeval_sessions').deleteOne({ _id: hashToken(token) });
    }
    clearSessionCookie(res);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/accounts', requireAccount, requireAdmin, async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const accounts = await collection<StoredAccount>(await getDatabase(), 'roboeval_accounts')
      .find({ role: { $ne: 'admin' } })
      .sort({ name: 1 })
      .toArray();
    res.json({ accounts: accounts.map(publicAccount) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/accounts', requireAccount, requireAdmin, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { username, name, password, role } = req.body || {};
    if (
      typeof username !== 'string' ||
      !/^[a-zA-Z0-9._-]{3,32}$/.test(username.trim()) ||
      typeof name !== 'string' ||
      name.trim().length < 2 ||
      typeof password !== 'string' ||
      password.length < 8 ||
      !['jurado_bachillerato', 'cronometro_linea'].includes(role)
    ) {
      res.status(400).json({ error: 'Datos inválidos: usuario (3-32 caracteres), nombre, contraseña (mínimo 8) y rol requerido.' });
      return;
    }
    const categoryByRole: Record<string, CategoryId> = {
      jurado_bachillerato: 'bachillerato',
      cronometro_linea: 'linea',
    };
    const badgeByRole: Record<string, string> = {
      jurado_bachillerato: 'Jurado de Automatización',
      cronometro_linea: 'Juez Oficial de Cronometraje',
    };
    const account = await createStoredAccount({
      username: username.trim(),
      name: name.trim(),
      role,
      assignedCategory: categoryByRole[role],
      badge: badgeByRole[role],
    }, password);
    try {
      await collection<StoredAccount>(await getDatabase(), 'roboeval_accounts').insertOne(account);
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        res.status(409).json({ error: 'Ese nombre de usuario ya está registrado.' });
        return;
      }
      throw error;
    }
    res.status(201).json({ user: publicAccount(account) });
  } catch (error) {
    next(error);
  }
});

function requireRole(roles: UserAccount['role'][]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.account || !roles.includes(req.account.role)) {
      res.status(403).json({ error: 'No tienes permisos para realizar esta acción.' });
      return;
    }
    next();
  };
}

app.post('/api/score', requireAccount, requireRole(['jurado_primaria', 'jurado_bachillerato']), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const accepted = await handleWsMessage({
      type: 'SUBMIT_SCORE',
      payload: { ...req.body, jurorId: req.account!._id, jurorName: req.account!.name },
    }, req.account, await getDatabase());
    if (!accepted) {
      res.status(403).json({ error: 'No puedes calificar proyectos de otra categoría o los puntajes no son válidos.' });
      return;
    }
    const state = await loadTournamentState(await getDatabase());
    res.json({ success: true, state });
  } catch (error) {
    next(error);
  }
});

app.post('/api/line-attempt', requireAccount, requireRole(['cronometro_linea']), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const database = await getDatabase();
    const accepted = await handleWsMessage({ type: 'SUBMIT_LINE_ATTEMPT', payload: req.body }, req.account, database);
    if (!accepted) {
      res.status(403).json({ error: 'Solo puedes registrar intentos válidos en Seguidores de Línea.' });
      return;
    }
    res.json({ success: true, state: await loadTournamentState(database) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/event/status', requireAccount, requireRole(['admin']), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const status = req.body?.status as TournamentState['status'];
    if (!['active', 'paused', 'finished'].includes(status)) {
      res.status(400).json({ error: 'Estado de evento inválido.' });
      return;
    }
    const database = await getDatabase();
    await recordActivity(database, 'status', `Estado del evento cambiado a: ${status}`, { status });
    const state = await loadTournamentState(database);
    broadcast({ type: 'STATE_UPDATED', payload: state });
    res.json({ success: true, state });
  } catch (error) {
    next(error);
  }
});

if (isProduction) {
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  const diagnostic = classifyMongoFailure(error, 'query');
  logError('Request failed', diagnostic);
  if (!res.headersSent) {
    res.status(diagnostic.stage === 'query' ? 500 : 503).json({
      error: diagnostic.guidance,
      diagnostic: { stage: diagnostic.stage, code: diagnostic.code },
    });
  }
});

async function startLocalServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  }
  server.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`RoboEval Live Server running on http://0.0.0.0:${PORT} (WS on /api/ws)`);
  });
}

if (!isVercel) {
  void startLocalServer().catch((error: unknown) => {
    logError('Failed to start local server', error);
    process.exitCode = 1;
  });
}

export { server };
