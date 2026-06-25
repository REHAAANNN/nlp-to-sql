import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { useEffect } from 'react';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import ConnectDatabase from './pages/ConnectDatabase';
import Dashboard from './pages/Dashboard';
import AIGenerator from './pages/AIGenerator';
import SchemaExplorer from './pages/SchemaExplorer';
import QueryHistory from './pages/QueryHistory';
import SavedQueries from './pages/SavedQueries';
import Settings from './pages/Settings';
import { useAppStore } from './hooks/useAppStore';
import { api } from './lib/api';

function ClerkApiBridge() {
  const { getToken } = useAuth();

  useEffect(() => {
    api.setClerkTokenProvider(() => getToken());
    return () => api.setClerkTokenProvider(null);
  }, [getToken]);

  return null;
}

function ProtectedRoutes() {
  const { isLoaded, isSignedIn } = useAuth();
  const { isDatabaseConnected, isSchemaAnalyzed } = useAppStore();

  if (!isLoaded) {
    return null;
  }

  if (!isSignedIn) {
    return <Navigate to="/login" replace />;
  }

  if (!isDatabaseConnected || !isSchemaAnalyzed) {
    return <Navigate to="/connect" replace />;
  }

  return <Outlet />;
}

export default function App() {
  const { isLoaded, isSignedIn } = useAuth();

  return (
    <BrowserRouter>
      <ClerkApiBridge />
      <Routes>
        <Route path="/login" element={isLoaded && isSignedIn ? <Navigate to="/connect" replace /> : <Login />} />
        <Route path="/connect" element={<ConnectDatabase />} />
        <Route element={<ProtectedRoutes />}>
          <Route element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="/generator" element={<AIGenerator />} />
          <Route path="/schema" element={<SchemaExplorer />} />
          <Route path="/history" element={<QueryHistory />} />
          <Route path="/saved" element={<SavedQueries />} />
          <Route path="/settings" element={<Settings />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}