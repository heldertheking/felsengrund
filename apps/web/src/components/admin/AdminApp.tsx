import { useEffect, useState, type FormEvent } from 'react';
import { api, clearAdminToken, getAdminToken, setAdminToken, unwrap } from '../../lib/api';
import Breadcrumbs from '../Breadcrumbs';
import OffersManager from './OffersManager';
import PodcastManager from './PodcastManager';
import GuidesIndex from './GuidesIndex';
import GuidePage from './GuidePage';
import { GUIDES, type GuideId } from '../../lib/guides';

type View = 'offers' | 'podcast' | 'guides' | 'guide-offers' | 'guide-podcast';

// The admin is one static page that .htaccess (and the dev middleware) serve for every /admin/* path, so each view
// gets a real URL: guides can be linked and opened in a second tab while a form stays untouched.
const VIEW_PATHS: Record<View, string> = {
  offers: '/admin',
  podcast: '/admin/podcast',
  guides: '/admin/anleitungen',
  'guide-offers': '/admin/anleitungen/angebote',
  'guide-podcast': '/admin/anleitungen/podcast',
};

function viewFromPath(): View {
  if (typeof window === 'undefined') return 'offers';
  const path = window.location.pathname.replace(/\/+$/, '') || '/admin';
  const match = (Object.entries(VIEW_PATHS) as [View, string][]).find(([, p]) => p === path);
  return match ? match[0] : 'offers';
}

const GUIDE_VIEWS: Record<GuideId, View> = { offers: 'guide-offers', podcast: 'guide-podcast' };

function LoginForm({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const { token } = await unwrap(api.admin.login.$post({ form: { password } }));
      setAdminToken(token);
      onLoggedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Anmeldung fehlgeschlagen.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Admin' }]} />
      <form onSubmit={handleSubmit} className="w-full rounded-2xl border border-kf-edge bg-kf-surface p-8 shadow-md">
        <h1 className="font-display text-lg font-bold text-kf-ink">Kirche Felsengrund - Admin</h1>
        <div className="mt-6">
          <label htmlFor="admin-password" className="text-xs font-semibold uppercase tracking-wide text-kf-ink-muted">
            Passwort
          </label>
          <input
            id="admin-password"
            type="password"
            required
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-kf-edge bg-kf-surface px-3 py-2 text-sm text-kf-ink focus:border-kf-accent focus:outline-none focus:ring-1 focus:ring-kf-accent"
          />
        </div>
        {error && (
          <p className="mt-3 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full rounded-lg bg-kf-accent px-5 py-2.5 font-display text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? 'Wird geprüft …' : 'Anmelden'}
        </button>
      </form>
      <p className="mt-3 text-center text-xs text-kf-ink-muted">Version {__APP_VERSION__}</p>
    </div>
  );
}

const NAV: { view: View; label: string; active: (v: View) => boolean }[] = [
  { view: 'offers', label: 'Angebote', active: (v) => v === 'offers' },
  { view: 'podcast', label: 'Podcast', active: (v) => v === 'podcast' },
  { view: 'guides', label: 'Anleitungen', active: (v) => v.startsWith('guide') },
];

function breadcrumbTail(view: View): { label: string; href?: string }[] {
  switch (view) {
    case 'offers':
      return [{ label: 'Angebote' }];
    case 'podcast':
      return [{ label: 'Podcast' }];
    case 'guides':
      return [{ label: 'Anleitungen' }];
    case 'guide-offers':
      return [{ label: 'Anleitungen', href: VIEW_PATHS.guides }, { label: GUIDES.offers.title }];
    case 'guide-podcast':
      return [{ label: 'Anleitungen', href: VIEW_PATHS.guides }, { label: GUIDES.podcast.title }];
  }
}

export default function AdminApp() {
  const [authenticated, setAuthenticated] = useState(() => Boolean(getAdminToken()));
  const [view, setView] = useState<View>(viewFromPath);

  useEffect(() => {
    const onPop = () => setView(viewFromPath());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  function navigate(next: View) {
    setView(next);
    window.history.pushState({}, '', VIEW_PATHS[next]);
    window.scrollTo({ top: 0 });
  }

  if (!authenticated) return <LoginForm onLoggedIn={() => setAuthenticated(true)} />;

  function handleLogout() {
    clearAdminToken();
    setAuthenticated(false);
  }

  function handleUnauthorized() {
    clearAdminToken();
    setAuthenticated(false);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Breadcrumbs
        items={[{ label: 'Home', href: '/' }, { label: 'Admin', href: '/admin' }, ...breadcrumbTail(view)]}
      />
      <div className="rounded-2xl border border-kf-edge bg-kf-surface p-8 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span className="font-display text-lg font-bold text-kf-ink">Kirche Felsengrund - Admin</span>
          <nav className="flex items-center gap-4 text-sm">
            {NAV.map((item) => (
              <button
                key={item.view}
                type="button"
                onClick={() => navigate(item.view)}
                className={`transition hover:text-kf-accent ${item.active(view) ? 'font-semibold text-kf-accent' : 'text-kf-ink-muted'}`}
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-kf-edge px-3 py-1.5 text-sm font-semibold text-kf-ink transition hover:border-kf-accent hover:text-kf-accent"
            >
              Abmelden
            </button>
          </nav>
        </div>
        <hr className="my-6 border-kf-edge" />
        {view === 'offers' && <OffersManager onUnauthorized={handleUnauthorized} />}
        {view === 'podcast' && <PodcastManager onUnauthorized={handleUnauthorized} />}
        {view === 'guides' && <GuidesIndex onOpen={(id) => navigate(GUIDE_VIEWS[id])} />}
        {(view === 'guide-offers' || view === 'guide-podcast') && (
          <>
            <button
              type="button"
              onClick={() => navigate('guides')}
              className="mb-5 text-sm text-kf-ink-muted hover:text-kf-accent"
            >
              ← Alle Anleitungen
            </button>
            <GuidePage guide={view === 'guide-offers' ? GUIDES.offers : GUIDES.podcast} />
          </>
        )}
      </div>
      <p className="mt-3 text-center text-xs text-kf-ink-muted">Version {__APP_VERSION__}</p>
    </div>
  );
}
