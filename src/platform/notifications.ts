import type { NotificationScheduler, ScheduledNotification } from './interfaces';

/**
 * Web implementation. Browsers have no reliable API for scheduling local notifications
 * while the app is fully closed (Notification Triggers never shipped), and a push relay
 * would require a server — which Phase 1 forbids. So reminders fire while Steady is open
 * or running in the background (installed PWA / background tab). A 20-second ticker is
 * robust to timer throttling and device sleep. Phase 2 swaps in native scheduling.
 */
const STALE_AFTER_MS = 20 * 60 * 1000;
const FIRED_KEY = 'steady.firedNotifications';

function loadFired(): Set<string> {
  try {
    const raw = sessionStorage.getItem(FIRED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveFired(s: Set<string>) {
  try {
    sessionStorage.setItem(FIRED_KEY, JSON.stringify([...s].slice(-200)));
  } catch {
    /* storage unavailable */
  }
}

export function createWebNotificationScheduler(onFire?: (n: ScheduledNotification) => void): NotificationScheduler {
  const queue = new Map<string, ScheduledNotification>();
  const fired = loadFired();

  async function display(n: Omit<ScheduledNotification, 'at' | 'id'>) {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const options: NotificationOptions & { actions?: { action: string; title: string }[]; renotify?: boolean } = {
      body: n.body,
      tag: n.tag,
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      data: { url: n.url ?? '/', ...n.data },
      requireInteraction: n.critical,
      silent: false,
      actions: n.actions,
    };
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg) {
        await reg.showNotification(n.title, options);
        return;
      }
    } catch {
      /* fall through */
    }
    try {
      new Notification(n.title, options);
    } catch {
      /* some mobile browsers only allow SW notifications */
    }
  }

  function tick() {
    const now = Date.now();
    for (const [id, n] of queue) {
      const at = n.at.getTime();
      if (at > now) continue;
      queue.delete(id);
      if (fired.has(id)) continue;
      fired.add(id);
      saveFired(fired);
      if (now - at > STALE_AFTER_MS) continue;
      onFire?.(n);
      void display(n);
    }
  }

  if (typeof window !== 'undefined') {
    setInterval(tick, 20_000);
    document.addEventListener('visibilitychange', tick);
  }

  return {
    async schedule(n) {
      if (!fired.has(n.id)) queue.set(n.id, n);
      tick();
      return n.id;
    },
    async cancel(id) {
      queue.delete(id);
    },
    async cancelAll() {
      queue.clear();
    },
    async requestPermission() {
      if (typeof Notification === 'undefined') return false;
      if (Notification.permission === 'granted') return true;
      const r = await Notification.requestPermission();
      return r === 'granted';
    },
    permission() {
      if (typeof Notification === 'undefined') return 'unsupported';
      return Notification.permission;
    },
    show: display,
  };
}
