import { useState, useEffect, useRef, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import FullPageLoader from '../../components/common/FullPageLoader/FullPageLoader';
import Button from '../../components/common/Button/Button';
import portalService from '../../services/portal/portal.service';
import StudentLayout from '../../layouts/StudentLayout';
import { PortalProvider } from '../../contexts/PortalContext';
import { setPortalAccessToken, clearPortalAccessToken } from '../../api/portalSession';
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

  const receiveToken = useCallback(async (accessToken) => {
    if (handledRef.current) return;
    handledRef.current = true;
    clearInterval(readyTimerRef.current);
    clearTimeout(expireTimerRef.current);
    setToken(accessToken);

    try {
      const res = await portalService.getPortalContext(accessToken);
      setPortalAccessToken(accessToken);
      setContext(res.data);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (!window.opener) {
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
      if (!handledRef.current) setStatus('expired');
    }, READY_TIMEOUT_MS);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearInterval(readyTimerRef.current);
      clearTimeout(expireTimerRef.current);
    };
  }, [receiveToken]);

  const closePortalTab = useCallback(() => {
    try {
      window.close();
    } catch {
      // Some browsers throw when a tab cannot close itself.
    }
  }, []);

  const returnToAdminPanel = useCallback(() => {
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.focus();
        window.opener.location.href = '/admin/students';
        return;
      }
    } catch {
      // Opener may be blocked for cross-origin access; fall back to local navigation.
    }
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