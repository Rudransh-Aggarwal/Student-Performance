import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  GithubAuthProvider,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { ApiError } from '../api/client';
import { chooseRole as requestRole, logoutSession, syncProfile } from '../api/auth';
import { auth } from '../lib/firebase';

const AuthContext = createContext(null);

const PROVIDERS = {
  google: () => new GoogleAuthProvider(),
  github: () => new GithubAuthProvider().addScope('user:email'),
};

const SYNC_ATTEMPTS = 3;
// Failures that retrying will not fix: bad request, invalid token, or no profile for this account.
const PERMANENT_STATUSES = new Set([400, 401, 403]);

function isPermanentFailure(error) {
  return error instanceof ApiError && PERMANENT_STATUSES.has(error.status);
}

/** Retries transient failures (network errors, 5xx) with backoff. Permanent failures are thrown at once. */
async function syncWithRetry() {
  let lastError;
  for (let attempt = 0; attempt < SYNC_ATTEMPTS; attempt += 1) {
    try {
      return await syncProfile();
    } catch (error) {
      lastError = error;
      if (isPermanentFailure(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
    }
  }
  throw lastError;
}

export function AuthProvider({ children }) {
  const [state, setState] = useState({ user: null, status: 'loading' });
  // While login/register runs, that action finishes the profile sync itself (so errors reach the form).
  const busy = useRef(false);

  // Loads the app profile for the signed-in Firebase user.
  const restore = useCallback(async (firebaseUser) => {
    if (!firebaseUser) {
      setState({ user: null, status: 'unauthenticated' });
      return;
    }
    // Keep an already-loaded user on screen while the profile is refreshed.
    setState((current) => (current.user ? current : { ...current, status: 'loading' }));
    try {
      const user = await syncWithRetry();
      setState({ user, status: 'authenticated' });
    } catch (error) {
      if (isPermanentFailure(error)) {
        await signOut(auth).catch(() => undefined);
        setState({ user: null, status: 'unauthenticated' });
      } else {
        // Transient failure: keep the Firebase session so the user can retry instead of being signed out.
        setState({ user: null, status: 'error' });
      }
    }
  }, []);

  // Restores the session after a page reload (Firebase persists it) and reacts to sign-out.
  useEffect(
    () =>
      onAuthStateChanged(auth, (firebaseUser) => {
        if (busy.current) return;
        void restore(firebaseUser);
      }),
    [restore],
  );

  const retrySession = useCallback(() => restore(auth.currentUser), [restore]);

  const complete = useCallback(async (signIn, details, discardAccountOnFailure = false) => {
    busy.current = true;
    try {
      await signIn();
      setState({ user: await syncProfile(details), status: 'authenticated' });
    } catch (error) {
      if (discardAccountOnFailure) await auth.currentUser?.delete().catch(() => undefined);
      await signOut(auth).catch(() => undefined);
      throw error;
    } finally {
      busy.current = false;
    }
  }, []);

  const login = useCallback(
    (email, password) => complete(() => signInWithEmailAndPassword(auth, email, password)),
    [complete],
  );

  const register = useCallback(
    ({ name, email, password, role }) =>
      complete(
        async () => {
          const { user } = await createUserWithEmailAndPassword(auth, email, password);
          await updateProfile(user, { displayName: name });
        },
        { name, role },
        true, // a failed sign-up must not leave a Firebase account without a profile/role
      ),
    [complete],
  );

  // `details` ({ role }) is only used if this sign-in creates the profile; existing accounts keep their role.
  const loginWithProvider = useCallback(
    (provider, details) => complete(() => signInWithPopup(auth, PROVIDERS[provider]()), details),
    [complete],
  );

  // One-time: sets the role of a pending social sign-up. Failures are shown by the caller.
  const chooseRole = useCallback(async (role) => {
    setState({ user: await requestRole(role), status: 'authenticated' });
  }, []);

  // Revokes server-side sessions first; signs out locally even if that request fails.
  const logout = useCallback(async () => {
    await logoutSession().catch(() => undefined);
    await signOut(auth);
  }, []);

  const value = useMemo(
    () => ({ ...state, login, register, loginWithProvider, chooseRole, logout, retrySession }),
    [state, login, register, loginWithProvider, chooseRole, logout, retrySession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}