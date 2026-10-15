import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
  localStorage.clear();
  window.history.replaceState({}, '', '/'); // admin views push real URLs; do not leak them into the next test
  vi.unstubAllGlobals();
});
