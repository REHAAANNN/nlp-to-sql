import { Bell, Database, LogOut, Unplug } from 'lucide-react';
import { useAppStore } from '../hooks/useAppStore';
import { useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';

export default function Navbar() {
  const { connectionSummary, toggleRightPanel, disconnectDatabase, isDatabaseConnected } = useAppStore();
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    disconnectDatabase();
    navigate('/login', { replace: true });
  };

  const handleDisconnect = () => {
    disconnectDatabase();
    navigate('/connect', { replace: true });
  };

  return (
    <header className="sticky top-0 z-20 flex min-h-14 items-center justify-between gap-4 border-b border-white/[0.08] bg-surface/80 px-4 backdrop-blur-xl sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-xs text-text-dim">/</span>
        <span className="truncate text-sm text-text-muted">
          {connectionSummary?.databaseName ?? 'Workspace'}
        </span>
      </div>

      <div className="flex flex-shrink-0 items-center gap-2">
        {isDatabaseConnected && (
          <button
            onClick={handleDisconnect}
            title="Disconnect database"
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-text-muted hover:text-danger hover:bg-danger/10 transition-all"
          >
            <Unplug className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Disconnect</span>
          </button>
        )}

        <div className="badge badge-cyan max-w-32 truncate">
          <Database className="w-3 h-3" />
          {connectionSummary?.databaseType ?? 'PostgreSQL'}
        </div>

        <button
          onClick={toggleRightPanel}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text hover:bg-white/[0.05] transition-all"
        >
          <Bell className="w-4 h-4" />
        </button>

        <button
          onClick={handleLogout}
          title="Logout"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-all"
        >
          <LogOut className="w-4 h-4" />
        </button>

        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-xs font-bold text-white">
          RA
        </div>
      </div>
    </header>
  );
}
