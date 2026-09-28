import { NavLink, Outlet } from 'react-router-dom';
import { BarChart3, CalendarClock, House, LifeBuoy, Menu, Plus } from 'lucide-react';
import { useUI } from '../state/ui';
import { cx } from './kit';
import { Toasts } from './Toasts';
import { QuickLogSheet } from '../features/seizures/QuickLogSheet';
import { SeizureTimer } from '../features/rescue/SeizureTimer';
import { UpdatePrompt } from './UpdatePrompt';
import { SafeModeSuggestion } from '../features/safemode/SafeModeSuggestion';
import { usePrefs } from '../data/hooks';

const NAV = [
  { to: '/', label: 'Today', icon: House, end: true },
  { to: '/insights', label: 'Insights', icon: BarChart3 },
  { to: '/schedule', label: 'Schedule', icon: CalendarClock },
  { to: '/more', label: 'More', icon: Menu },
];

export function Shell({ safe }: { safe: boolean }) {
  const setQuickLog = useUI((s) => s.setQuickLog);
  const prefs = usePrefs();
  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only-focusable fixed top-2 left-2 z-50 rounded-xl bg-accent px-4 py-3 font-bold text-accent-ink"
      >
        Skip to main content
      </a>
      <header className="no-print sticky top-0 z-30 border-b border-line bg-bg/95 pt-[env(safe-area-inset-top)] backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-2">
          <NavLink to="/" className="flex items-center gap-2 text-lg font-bold no-underline" aria-label="Steady — go to Today">
            <img src="/favicon.svg" alt="" width={32} height={32} className="rounded-lg" />
            <span>Steady</span>
            {safe && <span className="rounded-full border border-line-strong px-2 py-0.5 text-sm whitespace-nowrap">Safe mode</span>}
          </NavLink>
          <NavLink
            to="/rescue"
            className="tap inline-flex items-center gap-2 rounded-xl border-2 border-sos bg-sos px-4 font-bold text-sos-ink no-underline"
            aria-label="SOS — open rescue plan and emergency contacts"
          >
            <LifeBuoy aria-hidden size={22} />
            SOS
          </NavLink>
        </div>
      </header>

      <main id="main" className={cx('mx-auto max-w-2xl px-4 pt-4', safe ? 'pb-40' : 'pb-48')}>
        <Outlet />
      </main>

      <div className="no-print pointer-events-none fixed inset-x-0 z-30" style={{ bottom: safe ? 'calc(1rem + env(safe-area-inset-bottom))' : 'calc(5.25rem + env(safe-area-inset-bottom))' }}>
        <div className="mx-auto flex max-w-2xl flex-col items-end gap-3 px-4">
          <Toasts />
          <button
            type="button"
            onClick={() => setQuickLog(true)}
            className={cx(
              'tap ease-calm pointer-events-auto inline-flex items-center gap-2 rounded-full border-2 border-accent bg-accent px-6 font-bold text-accent-ink shadow-lg',
              safe ? 'py-5 text-2xl' : 'py-3 text-lg',
            )}
          >
            <Plus aria-hidden size={26} strokeWidth={3} />
            Log seizure
          </button>
        </div>
      </div>

      {!safe && (
        <nav aria-label="Main" className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
          <ul className="mx-auto grid max-w-2xl grid-cols-4">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    cx(
                      'tap flex flex-col items-center justify-center gap-0.5 py-2 text-sm font-bold no-underline',
                      isActive ? 'text-accent-text' : 'text-ink-2',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span className={cx('rounded-full px-4 py-0.5', isActive && 'bg-accent-soft')}>
                        <Icon aria-hidden size={24} strokeWidth={isActive ? 2.75 : 2} />
                      </span>
                      <span className={cx(isActive && 'underline decoration-2 underline-offset-4')}>{label}</span>
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <QuickLogSheet />
      <SeizureTimer />
      <SafeModeSuggestion />
      <UpdatePrompt />
      {prefs?.passcodeEnabled && <span className="sr-only">Passcode lock is on.</span>}
    </div>
  );
}
