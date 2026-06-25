import { Outlet } from 'react-router-dom';
import type { CSSProperties } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { useAppStore } from '../hooks/useAppStore';

export default function MainLayout() {
  const { sidebarCollapsed } = useAppStore();

  return (
    <div className="relative min-h-screen app-surface">
      <div className="soft-grid pointer-events-none fixed inset-0 z-0" />
      <Sidebar />
      <div
        className="layout-shell relative z-10 min-h-screen transition-all duration-300"
        style={{ '--sidebar-width': `${sidebarCollapsed ? 76 : 220}px` } as CSSProperties}
      >
        <Navbar />
        <main className="px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          <AnimatePresence mode="wait">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="page-container"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
