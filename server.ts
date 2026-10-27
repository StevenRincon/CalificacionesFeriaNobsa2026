import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import http from 'http';
import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { Collection, Db, MongoClient } from 'mongodb';
import { INITIAL_TOURNAMENT_STATE } from './src/data/defaultData.ts';
import { CategoryId, Project, TournamentState, UserAccount, WSMessage, LineAttempt } from './src/types.ts';
import { computeLineStats, computeRubricStats } from './src/utils/formatters.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;
const isVercel = Boolean(process.env.VERCEL);
const isProduction = process.env.NODE_ENV === 'production' || isVercel;
const SESSION_COOKIE = 'roboeval_session';
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const scrypt = promisify(scryptCallback);

const CATEGORY_BY_CODE: Record<string, CategoryId> = {
  seguidores: 'linea',
  automatizacion: 'bachillerato',
  educativos: 'primaria',
};

const CATEGORY_BY_NAME: Record<string, CategoryId> = {
  'seguidores de línea': 'linea',
  'proyecto de automatización electrónica': 'bachillerato',
  'proyectos educativos en robótica': 'primaria',
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

const globalMongo = globalThis as typeof globalThis & {
  roboevalMongoClientPromise?: Promise<MongoClient>;
  roboevalDatabaseReady?: Promise<Db>;
};

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
let wss: WebSocketServer;

function logError(context: string, error: unknown) {
  const name = error instanceof Error ? error.name : 'UnknownError';
  const code = error && typeof error === 'object' && 'code' in error
    ? ` (${String(error.code)})`
    : '';
  console.error(`${context}: ${name}${code}`);
}

function getMongoClient() {
  if (!process.env.MONGODB_URI) {
    throw new Error('Falta MONGODB_URI. Configura la conexión a MongoDB en .env o en las variables de Vercel.');
  }
  if (!globalMongo.roboevalMongoClientPromise) {
    const client = new MongoClient(process.env.MONGODB_URI);
    globalMongo.roboevalMongoClientPromise = client.connect().then(() => client).catch((error: unknown) => {
      globalMongo.roboevalMongoClientPromise = undefined;
      throw error;
    });
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
        await initializeCollections(database);
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

function categoryFromRegistration(registration: RegistrationDocument): CategoryId | undefined {
  const code = typeof registration.category === 'string' ? registration.category.trim().toLowerCase() : '';
  if (CATEGORY_BY_CODE[code]) return CATEGORY_BY_CODE[code];
  const name = typeof registration.categoryName === 'string'
    ? registration.categoryName.trim().toLocaleLowerCase('es')
    : '';
  return CATEGORY_BY_NAME[name];
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
    members: Array.isArray(registration.members)
      ? registration.members.filter((member): member is string => typeof member === 'string')
      : undefined,
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

async function loadTournamentState(database: Db): Promise<TournamentState> {
  const collections = getCollections(database);
  const [registrations, metadata] = await Promise.all([
    collections.registrations
      .find({ categoryName: { $in: Object.keys(CATEGORY_BY_NAME) } })
      .sort({ code: 1 })
      .toArray(),
    collections.metadata.findOne({ _id: 'tournament' }),
  ]);
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
      project.scores = evaluation.scores || {};
      const stats = computeRubricStats(project.scores);
      project.averageScore = stats.averageScore;
      project.evaluationsCount = stats.evaluationsCount;
    }
  }

  const defaults = INITIAL_TOURNAMENT_STATE;
  return {
    title: metadata?.title || defaults.title,
    subtitle: metadata?.subtitle || defaults.subtitle,
    status: metadata?.status || defaults.status,
    activeCategory: metadata?.activeCategory || defaults.activeCategory,
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
      metrics.every((metric) => Number.isFinite(scores[metric.id]) && scores[metric.id] >= metric.min && scores[metric.id] <= metric.max);
    const validFeedback = message.payload.feedback === undefined ||
      (typeof message.payload.feedback === 'string' && message.payload.feedback.length <= 2000);
    return account.role === `jurado_${project.categoryId}` && validScores && validFeedback;
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
    const total = Number((metricKeys.reduce((sum, key) => sum + message.payload.scores[key], 0) / metricKeys.length).toFixed(2));
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
      `${account.name} calificó a "${project.name}" (${project.code}) con ${total.toFixed(2)}/5.00`
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

const app = express();
const server = http.createServer(app);
wss = new WebSocketServer({ server, path: '/api/ws' });

if (isProduction) {
  app.use(express.static(path.join(__dirname, 'dist')));
}

app.use(express.json({ limit: '1mb' }));
app.use(async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await getDatabase();
    next();
  } catch (error) {
    logError('MongoDB connection or initialization failed', error);
    res.status(503).json({ error: 'No fue posible conectar con la base de datos. Revisa MONGODB_URI y los permisos de MongoDB Atlas.' });
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
      !['jurado_primaria', 'jurado_bachillerato', 'cronometro_linea'].includes(role)
    ) {
      res.status(400).json({ error: 'Datos inválidos: usuario (3-32 caracteres), nombre, contraseña (mínimo 8) y rol requerido.' });
      return;
    }
    const categoryByRole: Record<string, CategoryId> = {
      jurado_primaria: 'primaria',
      jurado_bachillerato: 'bachillerato',
      cronometro_linea: 'linea',
    };
    const badgeByRole: Record<string, string> = {
      jurado_primaria: 'Jurado Robótica Primaria',
      jurado_bachillerato: 'Jurado Robótica Bachillerato',
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
  logError('Request failed', error);
  if (!res.headersSent) res.status(500).json({ error: 'Error interno procesando la solicitud.' });
});

async function startLocalServer() {
  if (!isProduction) {
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

export default server;
