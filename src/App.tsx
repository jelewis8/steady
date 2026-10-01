import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { pageTitle } from './core/pageTitle';
import { todayKey } from './core/time';
import { requestPersistentStorage } from './data/db';
import { usePrefs, useProfile } from './data/hooks';
import { ensureDay, initDatabase, setDoseStatus } from './data/repo';
import { toast, useUI } from './state/ui';
import { isSafeMode, useApplyAppearance, useNow } from './ui/hooks';
import { Shell } from './ui/Shell';
import { LockScreen, useAutoLock } from './features/lock/LockScreen';
import { ReminderEngine } from './features/reminders/ReminderEngine';
import { TodayPage } from './features/today/TodayPage';
import { MorePage } from './features/settings/MorePage';
import { PrivacyPage, AboutPage } from './features/settings/InfoPages';
import { MedsPage } from './features/meds/MedsPage';
import { MedEditorPage } from './features/meds/MedEditorPage';
import { SeizureListPage } from './features/seizures/SeizureListPage';
import { SeizureFormPage } from './features/seizures/SeizureFormPage';
import { RescuePage } from './features/rescue/RescuePage';
import { CalmPage } from './features/rescue/CalmPage';

const BathroomPage = lazy(() => import('./features/bathroom/BathroomPage').then((m) => ({ default: m.BathroomPage })));
const CalendarPage = lazy(() => import('./features/calendar/CalendarPage').then((m) => ({ default: m.CalendarPage })));
const DayPage = lazy(() => import('./features/calendar/DayPage').then((m) => ({ default: m.DayPage })));
const SideEffectsPage = lazy(() => import('./features/meds/SideEffectsPage').then((m) => ({ default: m.SideEffectsPage })));
const SupportPage = lazy(() => import('./features/support/SupportPage').then((m) => ({ default: m.SupportPage })));
const SafetyPlanPage = lazy(() => import('./features/support/SafetyPlanPage').then((m) => ({ default: m.SafetyPlanPage })));
const SchedulePage = lazy(() => import('./features/routine/SchedulePage').then((m) => ({ default: m.SchedulePage })));
const DietPage = lazy(() => import('./features/diet/DietPage').then((m) => ({ default: m.DietPage })));
const SettingsPage = lazy(() => import('./features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const PlanEditorPage = lazy(() => import('./features/rescue/PlanEditorPage').then((m) => ({ default: m.PlanEditorPage })));
const SleepPage = lazy(() => import('./features/sleep/SleepPage').then((m) => ({ default: m.SleepPage })));
const InsightsPage = lazy(() => import('./features/insights/InsightsPage').then((m) => ({ default: m.InsightsPage })));
const OnboardingPage = lazy(() => import('./features/onboarding/OnboardingPage').then((m) => ({ default: m.OnboardingPage })));
const ReportPage = lazy(() => import('./features/insights/ReportPage').then((m) => ({ default: m.ReportPage })));
const DataPage = lazy(() => import('./features/settings/DataPage').then((m) => ({ default: m.DataPage })));
const PasscodePage = lazy(() => import('./features/lock/PasscodePage').then((m) => ({ default: m.PasscodePage })));
const PlanPrintPage = lazy(() => import('./features/rescue/PlanPrintPage').then((m) => ({ default: m.PlanPrintPage })));

function useBoot() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        await initDatabase();
        await ensureDay(todayKey());
        void requestPersistentStorage();
        setReady(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);
  return { ready, error };
}

/** Handle deep links from notifications and PWA shortcuts. */
function useUrlActions() {
  const [params, setParams] = useSearchParams();
  const setQuickLog = useUI((s) => s.setQuickLog);
  useEffect(() => {
    const log = params.get('log');
    const dose = params.get('dose');
    const act = params.get('act');
    if (!log && !dose) return;
    if (log === 'seizure') setQuickLog(true);
    if (dose && act === 'taken') {
      void setDoseStatus(dose, 'taken').then((undo) => toast('Dose recorded as taken.', undo));
    }
    const next = new URLSearchParams(params);
    ['log', 'dose', 'act'].forEach((k) => next.delete(k));
    setParams(next, { replace: true });
  }, [params, setParams, setQuickLog]);
}

export default function App() {
  const { ready, error } = useBoot();
  const profile = useProfile();
  const prefs = usePrefs();
  const now = useNow(60_000);
  const safe = isSafeMode(prefs, now);
  const locked = useUI((s) => s.locked);
  const loc = useLocation();
  const nav = useNavigate();
  const [day, setDay] = useState(todayKey());

  useApplyAppearance(prefs, safe);
  useAutoLock(prefs);
  useUrlActions();

  // Roll over at midnight: generate the new day's checklist.
  useEffect(() => {
    const k = todayKey(now);
    if (k !== day) {
      setDay(k);
      void ensureDay(k);
    }
  }, [now, day]);

  // On route change (screen reader + keyboard users): set the page title (B-004) and move focus to the main heading.
  // A page that loads for the first time is lazy, and React keeps the OLD page on screen until it is ready. If the heading is still
  // the one we focused last time, wait (up to 2 s) for the new page's heading instead of focusing one that is about to disappear.
  const lastH1 = useRef<{ el: HTMLElement; text: string } | null>(null);
  const lockedNow = locked && !!prefs?.passcodeEnabled;
  useEffect(() => {
    let timer = 0;
    let tries = 0;
    const apply = () => {
      if (lockedNow) {
        document.title = 'Steady'; // nothing about what the user was reading while the app is locked
        return;
      }
      const h = document.querySelector<HTMLElement>('main h1');
      const last = lastH1.current;
      const stale = !h || (last != null && last.el === h && last.text === h.textContent);
      if (stale && tries++ < 40) {
        timer = window.setTimeout(apply, 50);
        return;
      }
      if (!h) return;
      lastH1.current = { el: h, text: h.textContent ?? '' };
      document.title = pageTitle(loc.pathname, h.textContent);
      h.tabIndex = -1;
      h.focus({ preventScroll: false });
      window.scrollTo({ top: 0 });
    };
    window.scrollTo({ top: 0 });
    apply();
    return () => window.clearTimeout(timer);
  }, [loc.pathname, lockedNow]);

  useEffect(() => {
    if (ready && profile && !profile.onboarded && loc.pathname !== '/welcome') nav('/welcome', { replace: true });
  }, [ready, profile, loc.pathname, nav]);

  if (error) {
    return (
      <main className="mx-auto max-w-xl p-6">
        <h1 className="text-2xl font-bold">Steady couldn’t open its storage</h1>
        <p className="mt-2">
          This can happen in private browsing, or if site data is blocked. Your data is stored only in this browser, so Steady needs
          permission to use local storage.
        </p>
        <p className="mt-2 text-ink-2">Details: {error}</p>
      </main>
    );
  }
  if (!ready || !profile) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6" aria-busy="true">
        <p className="text-lg text-ink-2">Getting your day ready…</p>
      </main>
    );
  }
  if (locked && prefs?.passcodeEnabled) return <LockScreen />;

  return (
    <>
      <ReminderEngine />
      <Suspense fallback={<p className="p-6 text-lg text-ink-2">Opening…</p>}>
      <Routes>
        <Route path="/welcome" element={<OnboardingPage />} />
        <Route path="/rescue/plan/print" element={<PlanPrintPage />} />
        <Route path="/insights/report" element={<ReportPage />} />
        <Route element={<Shell safe={safe} />}>
          <Route index element={<TodayPage />} />
          <Route path="insights" element={<InsightsPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="bathroom" element={<BathroomPage />} />
          <Route path="day/:date" element={<DayPage />} />
          <Route path="schedule" element={<SchedulePage />} />
          <Route path="more" element={<MorePage />} />
          <Route path="meds" element={<MedsPage />} />
          <Route path="meds/side-effects" element={<SideEffectsPage />} />
          <Route path="meds/:id" element={<MedEditorPage />} />
          <Route path="seizures" element={<SeizureListPage />} />
          <Route path="seizures/:id" element={<SeizureFormPage />} />
          <Route path="sleep" element={<SleepPage />} />
          <Route path="diet" element={<DietPage />} />
          <Route path="rescue" element={<RescuePage />} />
          <Route path="rescue/plan" element={<PlanEditorPage />} />
          <Route path="rescue/calm" element={<CalmPage />} />
          <Route path="support" element={<SupportPage />} />
          <Route path="support/plan" element={<SafetyPlanPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="settings/data" element={<DataPage />} />
          <Route path="settings/passcode" element={<PasscodePage />} />
          <Route path="privacy" element={<PrivacyPage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      </Suspense>
    </>
  );
}
