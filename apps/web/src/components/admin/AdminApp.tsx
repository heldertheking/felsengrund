import { useState, type FormEvent } from 'react';
import { apiClient, clearAdminToken, getAdminToken, setAdminToken } from '../../lib/api';
import Breadcrumbs from '../Breadcrumbs';
import OffersManager from './OffersManager';
import PodcastManager from './PodcastManager';

type View = 'offers' | 'podcast';

function LoginForm({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const token = await apiClient.admin.login(password);
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
        <h1 className="font-display text-lg font-bold text-kf-ink">Kirche Felsengrund – Admin</h1>
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
    </div>
  );
}

export default function AdminApp() {
  const [authenticated, setAuthenticated] = useState(() => Boolean(getAdminToken()));
  const [view, setView] = useState<View>('offers');

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
        items={[
          { label: 'Home', href: '/' },
          { label: 'Admin' },
          { label: view === 'offers' ? 'Angebote' : 'Podcast' },
        ]}
      />
      <div className="rounded-2xl border border-kf-edge bg-kf-surface p-8 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span className="font-display text-lg font-bold text-kf-ink">Kirche Felsengrund – Admin</span>
          <nav className="flex items-center gap-4 text-sm">
            <button
              type="button"
              onClick={() => setView('offers')}
              className={`transition hover:text-kf-accent ${view === 'offers' ? 'font-semibold text-kf-accent' : 'text-kf-ink-muted'}`}
            >
              Angebote
            </button>
            <button
              type="button"
              onClick={() => setView('podcast')}
              className={`transition hover:text-kf-accent ${view === 'podcast' ? 'font-semibold text-kf-accent' : 'text-kf-ink-muted'}`}
            >
              Podcast
            </button>
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
        {view === 'offers' ? (
          <OffersManager onUnauthorized={handleUnauthorized} />
        ) : (
          <PodcastManager onUnauthorized={handleUnauthorized} />
        )}
      </div>
    </div>
  );
}
