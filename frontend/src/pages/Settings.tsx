import { motion } from 'framer-motion';
import {
  Sun,
  Moon,
  Database,
  Cpu,
  Palette,
  Bell,
  Shield,
  Info,
} from 'lucide-react';
import { useAppStore } from '../hooks/useAppStore';
import type { DatabaseType } from '../types';

export default function Settings() {
  const { theme, setTheme, selectedDb, setSelectedDb, selectedAI, setSelectedAI } = useAppStore();

  const settingsSections = [
    {
      title: 'Appearance',
      icon: Palette,
      items: [
        {
          label: 'Theme',
          description: 'Choose between dark and light mode',
          control: (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTheme('dark')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all ${
                  theme === 'dark'
                    ? 'bg-primary/20 text-primary-light border border-primary/30'
                    : 'bg-surface-light/50 text-text-muted border border-glass-border hover:text-text'
                }`}
              >
                <Moon className="w-4 h-4" />
                Dark
              </button>
              <button
                onClick={() => setTheme('light')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all ${
                  theme === 'light'
                    ? 'bg-primary/20 text-primary-light border border-primary/30'
                    : 'bg-surface-light/50 text-text-muted border border-glass-border hover:text-text'
                }`}
              >
                <Sun className="w-4 h-4" />
                Light
              </button>
            </div>
          ),
        },
      ],
    },
    {
      title: 'Database',
      icon: Database,
      items: [
        {
          label: 'Default Database',
          description: 'Select your primary database engine',
          control: (
            <select
              value={selectedDb}
              onChange={(e) => setSelectedDb(e.target.value as DatabaseType)}
              className="px-4 py-2 rounded-xl bg-surface-light/50 border border-glass-border text-sm text-text focus:outline-none focus:border-primary/50"
            >
              <option value="MySQL">MySQL</option>
              <option value="PostgreSQL">PostgreSQL</option>
            </select>
          ),
        },
      ],
    },
    {
      title: 'AI Provider',
      icon: Cpu,
      items: [
        {
          label: 'AI Model Provider',
          description: 'Choose the AI backend for query generation',
          control: (
            <select
              value={selectedAI}
              onChange={(e) => setSelectedAI(e.target.value)}
              className="px-4 py-2 rounded-xl bg-surface-light/50 border border-glass-border text-sm text-text focus:outline-none focus:border-primary/50"
            >
              <option value="Ollama">Ollama (Local)</option>
              <option value="Groq">Groq (Cloud)</option>
            </select>
          ),
        },
      ],
    },
    {
      title: 'Notifications',
      icon: Bell,
      items: [
        {
          label: 'Query Completion Alerts',
          description: 'Get notified when long-running queries complete',
          control: (
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" defaultChecked className="sr-only peer" />
              <div className="w-9 h-5 bg-surface-lighter rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
            </label>
          ),
        },
        {
          label: 'Performance Warnings',
          description: 'Alert when queries may impact database performance',
          control: (
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" defaultChecked className="sr-only peer" />
              <div className="w-9 h-5 bg-surface-lighter rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
            </label>
          ),
        },
      ],
    },
    {
      title: 'Security',
      icon: Shield,
      items: [
        {
          label: 'Auto-save Query History',
          description: 'Automatically save all executed queries',
          control: (
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" defaultChecked className="sr-only peer" />
              <div className="w-9 h-5 bg-surface-lighter rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
            </label>
          ),
        },
        {
          label: 'Confirm Destructive Queries',
          description: 'Require confirmation for UPDATE/DELETE queries',
          control: (
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" defaultChecked className="sr-only peer" />
              <div className="w-9 h-5 bg-surface-lighter rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
            </label>
          ),
        },
      ],
    },
  ];

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <span className="badge badge-cyan">Settings</span>
        <h1 className="mt-3 text-3xl font-bold text-white">Settings</h1>
        <p className="text-text-muted text-sm mt-1">Configure your SQL AI Assistant preferences</p>
      </div>

      {settingsSections.map((section, sectionIndex) => (
        <motion.div
          key={section.title}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: sectionIndex * 0.1 }}
          className="app-panel overflow-hidden p-0"
        >
          <div className="flex items-center gap-3 px-5 py-4 border-b border-glass-border">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <section.icon className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-sm font-semibold">{section.title}</h2>
          </div>
          <div className="divide-y divide-glass-border">
            {section.items.map((item) => (
              <div key={item.label} className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-text-muted mt-0.5">{item.description}</p>
                </div>
                {item.control}
              </div>
            ))}
          </div>
        </motion.div>
      ))}

      {/* About */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="app-panel"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Info className="w-4 h-4 text-white" />
          </div>
          <h2 className="text-sm font-semibold">About</h2>
        </div>
        <div className="space-y-2 text-sm text-text-muted">
          <p>SQL AI Assistant v1.0.0</p>
          <p>A premium AI-powered SQL query generation and management platform.</p>
          <p className="text-xs text-text-dim mt-2">
            Built with React 19, TypeScript, Tailwind CSS, and Monaco Editor.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
