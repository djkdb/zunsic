import { lazy, Suspense, useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import { useMotionAttribute } from '@/hooks/useMotion';
import { useSfxSetup } from '@/audio/useSfx';
import { startPersistence, useGameStore } from '@/store/gameStore';
import { HomeScreen } from '@/screens/HomeScreen';
import { SetupScreen } from '@/screens/SetupScreen';
import { GameScreen } from '@/screens/GameScreen';
import { ResultScreen } from '@/screens/ResultScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { Toasts } from '@/features/flow/Toasts';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { DEBUG_ENABLED } from '@/lib/debug';

const DebugPanel = lazy(() => import('@/features/debug/DebugPanel'));

export function App() {
  const hydrate = useGameStore((s) => s.hydrate);
  useMotionAttribute();
  useSfxSetup();
  useEffect(() => {
    hydrate();
    return startPersistence();
  }, [hydrate]);

  return (
    <ErrorBoundary>
      <HashRouter>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/setup" element={<SetupScreen />} />
          <Route path="/play/*" element={<GameScreen />} />
          <Route path="/result" element={<ResultScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toasts />
        {DEBUG_ENABLED && (
          <Suspense fallback={null}>
            <DebugPanel />
          </Suspense>
        )}
      </HashRouter>
    </ErrorBoundary>
  );
}

/** New screen → start at the top (the browser keeps the old scroll offset otherwise). */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
