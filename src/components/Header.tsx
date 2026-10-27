import React from 'react';
import { 
  Trophy, 
  Wifi, 
  WifiOff, 
  Sparkles, 
  Cpu, 
  Gauge, 
  FileCheck2, 
  ShieldCheck, 
  Volume2, 
  VolumeX 
} from 'lucide-react';
import { CategoryId, TournamentState, UserAccount } from '../types.ts';
import { CATEGORIES } from '../data/defaultData.ts';
import { soundFx } from '../utils/audio.ts';

interface HeaderProps {
  state: TournamentState;
  isConnected: boolean;
  currentUser: UserAccount;
  activeCategory: CategoryId;
  onSelectCategory: (cat: CategoryId) => void;
  currentView: 'home' | 'public' | 'jury' | 'admin';
  onChangeView: (view: 'home' | 'public' | 'jury' | 'admin') => void;
  onOpenLogin: () => void;
  onLogout: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  state,
  isConnected,
  currentUser,
  activeCategory,
  onSelectCategory,
  currentView,
  onChangeView,
  onOpenLogin,
  onLogout,
  soundEnabled,
  onToggleSound,
}) => {
  const getCategoryCount = (catId: CategoryId) => {
    return state.projects.filter((p) => p.categoryId === catId).length;
  };

  const getCategoryIcon = (id: CategoryId) => {
    switch (id) {
      case 'primaria':
        return <Sparkles className="w-4 h-4 text-emerald-400" />;
      case 'bachillerato':
        return <Cpu className="w-4 h-4 text-blue-400" />;
      case 'linea':
        return <Gauge className="w-4 h-4 text-amber-400" />;
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-[#0a0d14]/95 backdrop-blur-md border-b border-cyan-500/25 text-white shadow-2xl">
      {/* Top Banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          {/* Logo & Title */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded bg-[#11141d] border border-cyan-400 glow-cyan flex items-center justify-center">
              <Trophy className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-2 text-glow-cyan">
                  ROBO<span className="text-cyan-400">EVAL</span>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-sm bg-cyan-950/80 text-cyan-300 font-bold border border-cyan-400/50 glow-cyan">
                    LIVE WS
                  </span>
                </h1>
                
                {/* WebSocket connection status */}
                <span
                  title={isConnected ? 'Conectado a servidor WebSockets en tiempo real' : 'Reconectando a WebSockets...'}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-sm text-xs font-mono font-medium transition-colors ${
                    isConnected
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/40 glow-emerald'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/40'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                  {isConnected ? (
                    <span className="flex items-center gap-1">
                      <Wifi className="w-3 h-3" /> ONLINE
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <WifiOff className="w-3 h-3" /> RECONNECTING
                    </span>
                  )}
                </span>

                {/* Event status badge */}
                <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-sm font-bold border ${
                  state.status === 'active' 
                    ? 'bg-cyan-500/10 text-cyan-300 border-cyan-400/50' 
                    : state.status === 'paused'
                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/40'
                    : 'bg-purple-500/10 text-purple-300 border-purple-500/40'
                }`}>
                  {state.status === 'active' ? '[ TORNEO EN CURSO ]' : state.status === 'paused' ? '[ PAUSA OFICIAL ]' : '[ PREMIACIÓN ]'}
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate max-w-md font-mono">
                {state.title}
              </p>
            </div>
          </div>

          {/* Navigation Views & User Controls */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* View Switchers */}
            <div className="bg-[#11141d] p-1 rounded-sm border border-cyan-500/30 flex items-center gap-1">
              <button
                onClick={() => onChangeView('home')}
                className="px-3 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wider text-slate-300 hover:text-white hover:bg-slate-800"
              >
                Inicio
              </button>
              <button
                onClick={() => onChangeView('public')}
                className={`px-3 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                  currentView === 'public'
                    ? 'bg-cyan-400 text-slate-950 font-black shadow-lg shadow-cyan-400/20'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>Podio & Live</span>
              </button>

              <button
                onClick={() => onChangeView('jury')}
                className={`px-3 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                  currentView === 'jury'
                    ? 'bg-cyan-400 text-slate-950 font-black shadow-lg shadow-cyan-400/20'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <FileCheck2 className="w-3.5 h-3.5" />
                <span>Jurado</span>
              </button>

              {currentUser.role === 'admin' && (
                <button
                  onClick={() => onChangeView('admin')}
                  className={`px-3 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                    currentView === 'admin'
                      ? 'bg-amber-400 text-slate-950 font-black shadow-lg shadow-amber-400/20'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Control Maestro</span>
                </button>
              )}
            </div>

            {/* Sound Mute/Unmute */}
            <button
              onClick={() => {
                onToggleSound();
                if (!soundEnabled) soundFx.playBeep(600, 0.08);
              }}
              title={soundEnabled ? 'Sonidos activados' : 'Sonidos desactivados'}
              className="p-2 rounded-sm bg-[#11141d] hover:bg-slate-800 text-slate-300 hover:text-cyan-300 border border-cyan-500/30 transition-colors cursor-pointer"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
            </button>

            {/* User Profile / Switch Account */}
            <div className="flex items-center pl-2 border-l border-cyan-500/20">
              <button
                onClick={onOpenLogin}
                className="flex items-center gap-2 px-3 py-1.5 rounded-sm bg-[#11141d] hover:bg-slate-800 text-left border border-cyan-500/30 transition-colors cursor-pointer group"
              >
                <div className="w-7 h-7 rounded-sm bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 font-mono font-bold text-xs">
                  {currentUser.name.charAt(0)}
                </div>
                <div className="hidden sm:block">
                  <p className="text-xs font-bold text-white leading-tight truncate max-w-[120px] group-hover:text-cyan-300">
                    {currentUser.name}
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono leading-tight truncate max-w-[120px]">
                    {currentUser.badge}
                  </p>
                </div>
                <span className="text-[10px] bg-slate-800 text-cyan-400 border border-cyan-500/30 px-1.5 py-0.5 rounded-sm ml-1 font-mono">
                  CAMBIAR
                </span>
              </button>
              {currentUser.role !== 'viewer' && (
                <button
                  onClick={onLogout}
                  className="ml-2 px-2 py-1.5 rounded-sm text-xs font-bold text-rose-300 hover:bg-rose-500/10 border border-rose-500/30 transition-colors cursor-pointer"
                >
                  SALIR
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Categories Bar */}
        <div className="mt-3 pt-3 border-t border-cyan-500/20 flex items-center overflow-x-auto no-scrollbar gap-2">
          <span className="text-xs text-cyan-400 font-mono font-bold whitespace-nowrap mr-1 tracking-wider">
            CATEGORÍAS:
          </span>
          {CATEGORIES.map((cat) => {
            const count = getCategoryCount(cat.id);
            const isSelected = activeCategory === cat.id;
            const isAssignedElsewhere =
              currentUser.assignedCategory &&
              currentUser.assignedCategory !== 'all' &&
              currentUser.assignedCategory !== cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => onSelectCategory(cat.id)}
                disabled={Boolean(isAssignedElsewhere)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-sm text-xs font-bold whitespace-nowrap transition-all border uppercase tracking-wider ${
                  isAssignedElsewhere ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                } ${
                  isSelected
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 glow-cyan font-black'
                    : 'bg-[#11141d] text-slate-300 border-cyan-500/20 hover:border-cyan-500/60 hover:text-white'
                }`}
              >
                {getCategoryIcon(cat.id)}
                <span>{cat.shortName}</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-sm ${
                    isSelected ? 'bg-cyan-400 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
