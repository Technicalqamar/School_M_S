import { useState, useEffect, useRef, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import FullPageLoader from '../../components/common/FullPageLoader/FullPageLoader';
import Button from '../../components/common/Button/Button';
import portalService from '../../services/portal/portal.service';
import StudentLayout from '../../layouts/StudentLayout';
import { PortalProvider } from '../../contexts/PortalContext';
import {
  setPortalAccessToken,
  clearPortalAccessToken,
  subscribePortalSessionExpired,
} from '../../api/portalSession';
import { useTranslation } from '../../hooks/useLocalization';
import { LockClosedIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

const READY_TIMEOUT_MS = 20000;

const PortalAccess = () => {
  const { t } = useTranslation();
  const [status, setStatus] = useState('validating');
  const [context, setContext] = useState(null);
  const [token, setToken] = useState(null);
  const [exitLoading, setExitLoading] = useState(false);

  const handledRef = useRef(false);
  const readyTimerRef = useRef(null);
  const expireTimerRef = useRef(null);
  const statusRef = useRef(status);
  // Track whether this component is still mounted and whether the validation
  // step has already settled. The portal-context request is async; a late
  // response must not repaint the screen after we have left `validating`
  // (e.g. the handshake timed out) or after the tab/component unmounted.
  const mountedRef = useRef(true);
  const finishedRef = useRef(false);

  const receiveToken = useCallback(async (accessToken) => {
    if (handledRef.current) return;
    handledRef.current = true;
    clearInterval(readyTimerRef.current);
    clearTimeout(expireTimerRef.current);
    setToken(accessToken);

    try {
      const res = await portalService.getPortalContext(accessToken);
      if (!mountedRef.current || finishedRef.current) return;
      setPortalAccessToken(accessToken);
      setContext(res.data);
      finishedRef.current = true;
      setStatus('ready');
    } catch {
      // A rejected request (including the 20s portal-API timeout) means the
      // secure session could not be validated. Show the existing "unavailable"
      // state — this is not a confirmed token expiry, so it must stay distinct
      // from the `expired` state.
      if (!mountedRef.current || finishedRef.current) return;
      finishedRef.current = true;
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!window.opener) {
      finishedRef.current = true;
      const timer = setTimeout(() => setStatus('expired'), 0);
      return () => clearTimeout(timer);
    }

    const handleMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== 'SMS_PORTAL_ACCESS_TOKEN') return;
      if (!event.data?.token) return;
      receiveToken(event.data.token);
    };

    window.addEventListener('message', handleMessage);

    const sendReady = () => {
      if (handledRef.current || !window.opener) return;
      window.opener.postMessage({ type: 'SMS_PORTAL_READY' }, window.location.origin);
    };

    sendReady();
    readyTimerRef.current = setInterval(sendReady, 700);
    expireTimerRef.current = setTimeout(() => {
      if (!handledRef.current) {
        // No token arrived in time. Settle on `expired`, and block any late
        // handshake/token from repainting the screen afterwards.
        handledRef.current = true;
        finishedRef.current = true;
        setStatus('expired');
      }
    }, READY_TIMEOUT_MS);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearInterval(readyTimerRef.current);
      clearTimeout(expireTimerRef.current);
    };
  }, [receiveToken]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // When the short-lived portal token is rejected with 401, the API layer clears
  // only the portal token and notifies us. Reuse the existing "expired" state so
  // the tab shows the secure-session-unavailable screen (and unmounts the portal
  // UI) instead of silently failing repeated API calls. The Admin Panel's login
  // tokens in localStorage are never touched.
  useEffect(
    () =>
      subscribePortalSessionExpired(() => {
        if (statusRef.current !== 'ready') return;
        setToken(null);
        setContext(null);
        setStatus('expired');
      }),
    []
  );

  const closePortalTab = useCallback(() => {
    try {
      window.close();
    } catch {
      // Some browsers throw when a tab cannot close itself.
    }
  }, []);

  // Return to the Admin Panel by navigating THIS window. The previous
  // implementation navigated window.opener, which only reloaded the Admin Panel
  // tab in the background while the user stayed stranded on this expired Portal
  // screen (window.opener.focus()/opener access across popups is not reliable).
  // The Student Portal and Admin Panel share an origin and localStorage, so a
  // normal navigation restores the administrator's existing session without
  // clearing or invalidating it, and it drops the expired portal module state.
  const returnToAdminPanel = useCallback(() => {
    window.location.replace('/admin/students');
  }, []);

  const handleExitPortal = async () => {
    if (exitLoading || status === 'ended') return;
    setExitLoading(true);

    try {
      // 1. End / invalidate the temporary admin-authorized portal access server-side.
      if (token) {
        await portalService.endPortalAccess(token);
      }
    } catch {
      // Even if the remote access already ended or expired, proceed with local cleanup.
    } finally {
      // 2. Clear the temporary portal access context AND the per-tab portal
      //    token, so the shared admin credentials in localStorage are left
      //    fully untouched.
      clearPortalAccessToken();
      setToken(null);
      setContext(null);

      // 3. Show the "access ended" state. This doubles as the fallback screen if
      //    the browser refuses to close the tab programmatically.
      setStatus('ended');
      setExitLoading(false);

      // 4. Return the admin to the Admin Panel (Student Management).
      returnToAdminPanel();

      // 5. Close only the current Student Portal tab. The original Admin Panel
      //    tab (window.opener) is left untouched and stays logged in.
      closePortalTab();
    }
  };

  if (status === 'ready' && context) {
    const portalUser = {
      id: context.student.id,
      fullName: context.student.fullName,
      studentId: context.student.studentId,
      role: 'student',
      student: context.student,
      profile: context.student,
    };

    return (
      <PortalProvider
        value={{
          isPortalAccess: true,
          user: portalUser,
          student: context.student,
          admin: context.admin,
          onExit: handleExitPortal,
          exitLoading,
        }}
      >
        <StudentLayout>
          <Outlet />
        </StudentLayout>
      </PortalProvider>
    );
  }

  if (status === 'ended') {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-950 flex items-center justify-center p-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-8 text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <CheckCircleIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('portalAccessEndedTitle')}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            {t('portalAccessEnded')}
          </p>
          <Button variant="primary" onClick={returnToAdminPanel} loading={exitLoading}>
            {t('backToAdmin')}
          </Button>
        </div>
      </div>
    );
  }

  if (status === 'expired' || status === 'error') {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-950 flex items-center justify-center p-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-8 text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <LockClosedIcon className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('portalAccessUnavailableTitle')}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            {t('portalAccessUnavailable')}
          </p>
          <Button variant="primary" onClick={returnToAdminPanel}>
            {t('backToAdmin')}
          </Button>
        </div>
      </div>
    );
  }

  return <FullPageLoader message={t('validatingPortalAccess')} />;
};

export default PortalAccess;