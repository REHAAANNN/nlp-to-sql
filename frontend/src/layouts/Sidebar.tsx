import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Database,
  History,
  LayoutDashboard,
  Settings,
  Sparkles,
  Terminal,
} from 'lucide-react';
import { useAppStore } from '../hooks/useAppStore';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/generator', icon: Sparkles, label: 'Generator' },
  { path: '/schema', icon: Database, label: 'Schema' },
  { path: '/history', icon: History, label: 'History' },
  { path: '/saved', icon: Bookmark, label: 'Saved' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useAppStore();

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarCollapsed ? 76 : 220 }}
      className="fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-white/[0.08] bg-surface/90 backdrop-blur-xl"
    >
      <div className="flex h-14 items-center gap-3 border-b border-white/[0.08] px-4">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent">
          <Terminal className="h-4 w-4 text-white" />
        </div>
        {!sidebarCollapsed && (
          <div className="min-w-0 overflow-hidden">
            <p className="truncate text-sm font-bold text-white">SQL AI</p>
            <p className="truncate text-[10px] text-text-dim">Assistant</p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all ${
                isActive
                  ? 'bg-cyan-400/10 text-accent-light'
                  : 'text-text-muted hover:bg-white/[0.04] hover:text-text'
              }`
            }
          >
            <item.icon className="h-4 w-4 flex-shrink-0" />
            {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/[0.08] p-2">
        <button
          onClick={toggleSidebar}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-2 py-2 text-xs text-text-dim transition-all hover:bg-white/[0.04] hover:text-text-muted"
        >
          {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          {!sidebarCollapsed && <span>Collapse</span>}
        </button>
      </div>
    </motion.aside>
  );
}
