import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getPortalAccessToken, subscribePortalAccessToken } from '../api/portalSession';
import {
  disconnectSocket,
  ensureSocket,
  setSocketTokenProvider,
} from './socket';
import { REALTIME_EVENTS, REALTIME_BUS_EVENTS } from './events';
import { publishRealtime } from './realtimeBus';
import {
  notificationServiceKeyForRole,
  noticeServiceKeyForRole,
  isLeaveStatusNotification,
} from './routing';
import notificationService from '../services/communication/notification.service';
import noticeService from '../services/communication/notice.service';
import receptionistNotificationService from '../services/receptionist/receptionistNotification.service';
import studentNotificationsService from '../services/student/studentNotifications.service';
import teacherNotificationsService from '../services/teacher/teacherNotifications.service';
import studentNoticesService from '../services/student/studentNotices.service';
import teacherNoticesService from '../services/teacher/teacherNotices.service';

// ─────────────────────────────────────────────────────────────────────────────
// Shared realtime connection + fan-out.
//
// Mounted once, inside AuthProvider, so it can read the session and reconnect
// on login/logout/token changes. It owns the single Socket.IO connection and
// translates server events into refresh signals for the existing REST-backed
// services:
//
//   • notifications — the role-appropriate notifications service emits a change,
//     so every bell/badge/list that already subscribes refreshes itself;
//   • notices — the recipient notice service (or the admin notice list) emits a
//     change;
//   • leaves — a bus event is published for the portal leave pages, which
//     refetch with their own current filters (there is no shared leave store).
//
// The socket never carries authorization decisions: the backend derives the
// principal, its role and its rooms from the signed token. The role reported by
// the server is used *only* to choose which UI surface to refresh.
// ─────────────────────────────────────────────────────────────────────────────

const RealtimeContext = createContext({ connected: false, role: null });

// eslint-disable-next-line react-refresh/only-export-components
export const useRealtime = () => useContext(RealtimeContext);

// A Student/Teacher leave decision arrives as a notification; the portal leave
// list is refreshed off the same signal instead of a second server event.
const resolveToken = () => getPortalAccessToken() || localStorage.getItem('accessToken');

// Maps a routing key to the concrete service that owns that principal's data.
const NOTIFICATION_SERVICES = {
  admin: notificationService,
  student: studentNotificationsService,
  teacher: teacherNotificationsService,
  receptionist: receptionistNotificationService,
};

const NOTICE_SERVICES = {
  admin: noticeService,
  student: studentNoticesService,
  teacher: teacherNoticesService,
};

export const RealtimeProvider = ({ children }) => {
  const { user, role } = useAuth();
  const [connected, setConnected] = useState(false);
  const [principalRole, setPrincipalRole] = useState(null);
  // Bumped whenever the portal access token is set/cleared, so the connection
  // re-handshakes as the newly signed-in principal.
  const [portalVersion, setPortalVersion] = useState(0);
  const principalRoleRef = useRef(null);

  useEffect(() => subscribePortalAccessToken(() => setPortalVersion((value) => value + 1)), []);

  const userId = user?.id || user?._id || null;
  const hasToken = Boolean(resolveToken());
  // Identity + token source. A rotated access token does NOT change this: the
  // socket stays up and reads the fresh token on its next reconnect.
  const connectKey = `${role || 'none'}:${userId || 'none'}:${hasToken ? 'token' : 'no-token'}:${portalVersion}`;

  useEffect(() => {
    const token = resolveToken();
    if (!token) {
      disconnectSocket();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setConnected(false);
      setPrincipalRole(null);
      principalRoleRef.current = null;
      return undefined;
    }

    setSocketTokenProvider(resolveToken);
    const socket = ensureSocket();

    const timers = {};
    const schedule = (key, fn) => {
      if (timers[key]) return;
      timers[key] = setTimeout(() => {
        delete timers[key];
        fn();
      }, 60);
    };

    const refreshNotifications = (targetRole) => {
      const key = notificationServiceKeyForRole(targetRole);
      if (key) NOTIFICATION_SERVICES[key].emitChange();
      publishRealtime(REALTIME_BUS_EVENTS.NOTIFICATIONS_CHANGED);
    };

    const refreshNotices = (targetRole) => {
      // Admins and receptionists share the admin Notices screen.
      const key = noticeServiceKeyForRole(targetRole);
      NOTICE_SERVICES[key].emitChange();
      publishRealtime(REALTIME_BUS_EVENTS.NOTICES_CHANGED);
    };

    const refreshLeaves = (detail) => {
      // Leave lists live in page components; the bus lets them refetch with
      // their own current filters. Nothing to refresh at the service layer.
      publishRealtime(REALTIME_BUS_EVENTS.LEAVES_CHANGED, detail);
    };

    const handleReady = (payload) => {
      const nextRole = payload?.role || null;
      principalRoleRef.current = nextRole;
      setPrincipalRole(nextRole);
      setConnected(true);
      // The server re-emits `realtime:ready` on every successful (re)handshake,
      // so this is also the reconnect resync: every surface re-reads from REST.
      refreshNotifications(nextRole);
      refreshNotices(nextRole);
      refreshLeaves({ reason: 'ready' });
      publishRealtime(REALTIME_BUS_EVENTS.RESYNC, { role: nextRole });
    };

    const handleNotificationNew = (payload) => {
      const notification = payload?.notification;
      schedule('notifications', () => refreshNotifications(principalRoleRef.current));
      if (notification && isLeaveStatusNotification(notification.type)) {
        schedule('leaves', () => refreshLeaves({ reason: 'notification', type: notification.type }));
      }
    };

    const handleNotificationUpdate = () => {
      schedule('notifications', () => refreshNotifications(principalRoleRef.current));
    };

    const handleNoticeChanged = () => {
      schedule('notices', () => refreshNotices(principalRoleRef.current));
    };

    const handleLeaveChanged = () => {
      schedule('leaves', () => refreshLeaves({ reason: 'event' }));
    };

    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);
    const handleConnectError = () => {
      // A rejected handshake (expired/invalid token) or an unreachable server.
      // Socket.IO keeps retrying and re-reads the token on each attempt, so the
      // next successful REST refresh (which rotates the token) heals this
      // automatically. Nothing sensitive is logged.
      setConnected(false);
    };

    socket.on(REALTIME_EVENTS.READY, handleReady);
    socket.on(REALTIME_EVENTS.NOTIFICATION_NEW, handleNotificationNew);
    socket.on(REALTIME_EVENTS.NOTIFICATION_READ, handleNotificationUpdate);
    socket.on(REALTIME_EVENTS.NOTIFICATION_ALL_READ, handleNotificationUpdate);
    socket.on(REALTIME_EVENTS.NOTIFICATION_DELETED, handleNotificationUpdate);
    socket.on(REALTIME_EVENTS.NOTIFICATION_UNREAD_COUNT, handleNotificationUpdate);
    socket.on(REALTIME_EVENTS.NOTICE_CHANGED, handleNoticeChanged);
    socket.on(REALTIME_EVENTS.LEAVE_CHANGED, handleLeaveChanged);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);

    if (!socket.connected) socket.connect();

    return () => {
      socket.off(REALTIME_EVENTS.READY, handleReady);
      socket.off(REALTIME_EVENTS.NOTIFICATION_NEW, handleNotificationNew);
      socket.off(REALTIME_EVENTS.NOTIFICATION_READ, handleNotificationUpdate);
      socket.off(REALTIME_EVENTS.NOTIFICATION_ALL_READ, handleNotificationUpdate);
      socket.off(REALTIME_EVENTS.NOTIFICATION_DELETED, handleNotificationUpdate);
      socket.off(REALTIME_EVENTS.NOTIFICATION_UNREAD_COUNT, handleNotificationUpdate);
      socket.off(REALTIME_EVENTS.NOTICE_CHANGED, handleNoticeChanged);
      socket.off(REALTIME_EVENTS.LEAVE_CHANGED, handleLeaveChanged);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      Object.values(timers).forEach((id) => clearTimeout(id));
      // Drop the connection so a later session (or the Strict-Mode remount)
      // always re-handshakes with the current token and never reuses handlers.
      disconnectSocket();
    };
  }, [connectKey]);

  return (
    <RealtimeContext.Provider value={{ connected, role: principalRole }}>
      {children}
    </RealtimeContext.Provider>
  );
};

export default RealtimeProvider;
