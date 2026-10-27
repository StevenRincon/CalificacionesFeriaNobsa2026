import React, { useEffect, useState } from 'react';
import { useTournamentSocket } from './hooks/useTournamentSocket.ts';
import { Header } from './components/Header.tsx';
import { PodiumView } from './components/PodiumView.tsx';
import { LeaderboardTable } from './components/LeaderboardTable.tsx';
import { JuryEvaluationPanel } from './components/JuryEvaluationPanel.tsx';
import { LineFollowerJudgePanel } from './components/LineFollowerJudgePanel.tsx';
import { AdminPanel } from './components/AdminPanel.tsx';
import { LoginModal } from './components/LoginModal.tsx';
import { ProjectDetailModal } from './components/ProjectDetailModal.tsx';
import { CATEGORIES, DEFAULT_METRICS } from './data/defaultData.ts';
import { CategoryId, Project, UserAccount } from './types.ts';
import { soundFx } from './utils/audio.ts';
import { 
  Trophy, 
  Sparkles, 
  Cpu, 
  Gauge, 
  FileCheck2, 
  ShieldCheck
} from 'lucide-react';

const VISITOR_USER: UserAccount = {
  id: 'public-viewer',
  username: '',
  name: 'Consulta pública',
  role: 'viewer',
  badge: 'Solo lectura',
};

export default function App() {
  const {
    state,
    isConnected,
    reconnect,
    refreshProjects,
    submitScore,
    submitLineAttempt,
    updateEventStatus,
  } = useTournamentSocket();

  const [currentUser, setCurrentUser] = useState<UserAccount>(VISITOR_USER);
  const [activeCategory, setActiveCategory] = useState<CategoryId>('bachillerato');
  const [currentView, setCurrentView] = useState<'home' | 'public' | 'jury' | 'admin'>('home');

  // Modals
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [selectedDetailProject, setSelectedDetailProject] = useState<Project | null>(null);

  // Audio state
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  useEffect(() => {
    let active = true;
    fetch('/api/auth/me')
      .then(async (response) => {
        if (!response.ok) return;
        const result = await response.json();
        if (!active) return;
        const user = result.user as UserAccount;
        setCurrentUser(user);
        reconnect();
        if (user.assignedCategory && user.assignedCategory !== 'all') {
          setActiveCategory(user.assignedCategory);
        }
        void refreshProjects().catch((error: unknown) => {
          console.error('[RoboEval] No se pudo cargar la lista completa de proyectos al restaurar la sesión', error);
        });
      })
      .catch((error: unknown) => console.error('No se pudo restaurar la sesión:', error));
    return () => {
      active = false;
    };
  }, [reconnect, refreshProjects]);

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundFx.setEnabled(next);
  };

  const handleUserSelect = (user: UserAccount) => {
    setCurrentUser(user);
    reconnect();
    void refreshProjects().catch((error: unknown) => {
      console.error('[RoboEval] No se pudo cargar la lista completa de proyectos después del inicio de sesión', error);
    });
    if (user.assignedCategory && user.assignedCategory !== 'all') {
      setActiveCategory(user.assignedCategory);
      setCurrentView('jury');
    } else {
      setCurrentView(user.role === 'admin' ? 'admin' : 'public');
    }
  };

  const handleSelectCategory = (categoryId: CategoryId) => {
    const category = CATEGORIES.find((item) => item.id === categoryId);
    const categoryProjects = state.projects.filter((project) => project.categoryId === categoryId);
    const isAllowed = !(
      currentUser.assignedCategory &&
      currentUser.assignedCategory !== 'all' &&
      currentUser.assignedCategory !== categoryId
    );
    console.info('[RoboEval] Selección de categoría', {
      categoryId,
      categoryName: category?.name,
      isAllowed,
      totalProjectsLoaded: state.projects.length,
      projectsInCategory: categoryProjects.length,
    });
    console.table(categoryProjects.map(({ code, name, categoryId: projectCategory }) => ({
      code,
      name,
      categoryId: projectCategory,
    })));
    if (!isAllowed) return;
    setActiveCategory(categoryId);
    void refreshProjects(categoryId).catch((error: unknown) => {
      console.error('[RoboEval] No se pudieron cargar los proyectos de la categoría seleccionada', {
        categoryId,
        error,
      });
    });
  };

  const handleChangeView = (view: 'home' | 'public' | 'jury' | 'admin') => {
    if (view === 'jury' && currentUser.role === 'viewer') {
      setIsLoginModalOpen(true);
      return;
    }
    if (view === 'admin' && currentUser.role !== 'admin') {
      setIsLoginModalOpen(true);
      return;
    }
    setCurrentView(view);
  };

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error('No se pudo cerrar la sesión.');
      setCurrentUser(VISITOR_USER);
      setCurrentView('home');
      reconnect();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  const activeCategoryInfo = CATEGORIES.find((c) => c.id === activeCategory) || CATEGORIES[0];
  const activeMetrics = activeCategory === 'linea' ? [] : DEFAULT_METRICS;

  return (
    <div className="min-h-screen bg-[#05060a] bg-grid-pattern text-slate-100 flex flex-col font-tech selection:bg-cyan-500 selection:text-slate-950 relative overflow-x-hidden">
      {/* Ambient Cyber Grid & Glow Orbs */}
      <div className="fixed inset-0 pointer-events-none bg-dot-matrix opacity-20 z-0" />
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[140px] pointer-events-none -z-10" />

      {currentView !== 'home' && (
        <Header
          state={state}
          isConnected={isConnected}
          currentUser={currentUser}
          activeCategory={activeCategory}
          onSelectCategory={handleSelectCategory}
          currentView={currentView}
          onChangeView={handleChangeView}
          onOpenLogin={() => setIsLoginModalOpen(true)}
          onLogout={handleLogout}
          soundEnabled={soundEnabled}
          onToggleSound={handleToggleSound}
        />
      )}

      {/* Main Content Area */}
      <main className={`flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 relative z-10 ${currentView === 'home' ? 'flex items-center justify-center' : ''}`}>
        {currentView === 'home' && (
          <section className="w-full max-w-xl mx-auto text-center space-y-8">
            <div className="space-y-3">
              <Trophy className="w-14 h-14 mx-auto text-cyan-400" />
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-300 font-mono">RoboEval Live</p>
              <h1 className="text-3xl sm:text-4xl font-black text-white">Feria de Robótica</h1>
              <p className="text-sm text-slate-400">Selecciona cómo deseas ingresar</p>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <button
                type="button"
                onClick={() => currentUser.role === 'viewer' ? setIsLoginModalOpen(true) : setCurrentView(currentUser.role === 'admin' ? 'admin' : 'jury')}
                className="cyber-button-primary min-h-16 w-full px-6 py-5 text-base font-bold flex items-center justify-center gap-3"
              >
                <FileCheck2 className="w-5 h-5" />
                ACCEDER COMO JURADO
              </button>
              <button
                type="button"
                onClick={() => setCurrentView('public')}
                className="min-h-16 w-full px-6 py-5 rounded-sm border border-cyan-500/40 bg-[#11141d] text-cyan-200 hover:bg-slate-800 font-bold text-base flex items-center justify-center gap-3"
              >
                <Trophy className="w-5 h-5 text-amber-400" />
                VER PODIOS Y CLASIFICACIÓN
              </button>
            </div>
          </section>
        )}

        {currentView !== 'home' && (
        <>
        
        {/* Category Description Banner */}
        <div className="mb-6 cyber-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-l-4 border-l-cyan-400">
          <div className="flex items-start gap-3">
            <div className={`p-2.5 rounded border flex-shrink-0 ${
              activeCategory === 'primaria'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : activeCategory === 'bachillerato'
                ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
            }`}>
              {activeCategory === 'primaria' && <Sparkles className="w-5 h-5" />}
              {activeCategory === 'bachillerato' && <Cpu className="w-5 h-5" />}
              {activeCategory === 'linea' && <Gauge className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-cyan-400">
                  // CATEGORÍA ACTIVA
                </span>
                <h2 className="text-sm sm:text-base font-extrabold text-white tracking-wide">
                  {activeCategoryInfo.name}
                </h2>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                {activeCategoryInfo.description}
              </p>
            </div>
          </div>

          {/* Quick Action to switch between results and evaluation */}
          <div className="flex items-center gap-2 self-end sm:self-center">
            {currentView === 'public' ? (
              <button
                onClick={() => handleChangeView('jury')}
                className="cyber-button-primary px-4 py-2 text-xs flex items-center gap-2 cursor-pointer"
              >
                <FileCheck2 className="w-3.5 h-3.5" />
                <span>{currentUser.role === 'viewer' ? 'INICIAR SESIÓN PARA EVALUAR' : `EVALUAR: ${currentUser.name.split(' ')[0]}`}</span>
              </button>
            ) : (
              <button
                onClick={() => setCurrentView('public')}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-500/40 hover:border-cyan-400 text-xs font-bold uppercase tracking-wider rounded-sm flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span>VER PODIO & RANKING</span>
              </button>
            )}
          </div>
        </div>

        {/* VIEW 1: PANTALLA PÚBLICA DE RESULTADOS & PODIO */}
        {currentView === 'public' && (
          <div className="space-y-6 animate-fade-in">
            {/* Podium component for active category */}
            <PodiumView
              categoryId={activeCategory}
              projects={state.projects}
              onSelectProject={(p) => setSelectedDetailProject(p)}
            />

            {/* Comprehensive ranking table */}
            <LeaderboardTable
              categoryId={activeCategory}
              projects={state.projects}
              metrics={activeMetrics}
              onSelectProject={(p) => setSelectedDetailProject(p)}
            />
          </div>
        )}

        {/* VIEW 2: PANEL DE JURADO / CRONOMETRAJE */}
        {currentView === 'jury' && (
          <div className="animate-fade-in">
            {currentUser.role === 'viewer' ? (
              <div className="cyber-card p-8 text-center space-y-4">
                <ShieldCheck className="w-10 h-10 text-cyan-400 mx-auto" />
                <h2 className="text-lg font-bold text-white">Inicia sesión para evaluar</h2>
                <p className="text-sm text-slate-400">El jurado debe autenticarse con las credenciales asignadas por la administración.</p>
                <button onClick={() => setIsLoginModalOpen(true)} className="cyber-button-primary px-5 py-2 text-xs">INICIAR SESIÓN</button>
              </div>
            ) : activeCategory === 'linea' ? (
              <LineFollowerJudgePanel
                projects={state.projects}
                currentUser={currentUser}
                onSubmitLineAttempt={(projId, attempt) => {
                  submitLineAttempt(projId, attempt);
                }}
              />
            ) : (
              <JuryEvaluationPanel
                categoryId={activeCategory}
                projects={state.projects}
                metrics={activeMetrics}
                currentUser={currentUser}
                onSubmitScore={(projId, jurorId, jurorName, scores, feedback) => {
                  submitScore(projId, jurorId, jurorName, scores, feedback);
                }}
              />
            )}
          </div>
        )}

        {/* VIEW 3: CONTROL MAESTRO / ADMIN */}
        {currentView === 'admin' && (
          <div className="animate-fade-in">
            <AdminPanel
              state={state}
              activeCategory={activeCategory}
              onUpdateEventStatus={updateEventStatus}
              onRefreshProjects={refreshProjects}
            />
          </div>
        )}
        </>
        )}
      </main>

      {/* Footer */}
      {currentView !== 'home' && <footer className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>RoboEval Live WS — Sistema de Evaluación y Cronometraje de Robótica</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-[11px] text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              Sincronización en Tiempo Real
            </span>
            <span>•</span>
            <button
              onClick={() => setIsLoginModalOpen(true)}
              className="text-slate-400 hover:text-white underline cursor-pointer"
            >
              Cambiar Jurado / Credenciales
            </button>
          </div>
        </div>
      </footer>}

      {/* Login & Role Switcher Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSelectUser={handleUserSelect}
      />

      {/* Project Detail Modal */}
      <ProjectDetailModal
        project={selectedDetailProject}
        metrics={activeMetrics}
        onClose={() => setSelectedDetailProject(null)}
      />
    </div>
  );
}
