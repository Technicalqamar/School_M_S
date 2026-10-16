import { useState, useEffect } from 'react';
import {
  PaperAirplaneIcon,
  BellAlertIcon,
  PhoneIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import CardSection from '../../common/CardSection/CardSection';
import Input from '../../common/Input/Input';
import Alert from '../../common/Alert/Alert';
import { useAuth } from '../../../contexts/AuthContext';
import studentService from '../../../services/student/student.service';
import {
  NOTICE_TYPES,
  getStudentNoticeRecipient,
  buildStudentNoticePayload,
} from '../../../utils/singleStudentActions';

// The student-specific "Send Notice / Reminder" action.
//
// It is deliberately single-target: the recipient is the student currently open
// in the workspace and is never chosen from a class or a bulk list. The only
// operational single-recipient channel in this build is the in-app notification
// delivered to the student's own portal inbox (there is no parent portal and no
// external SMS provider is wired in), so the component states that channel
// plainly instead of implying an SMS/WhatsApp/email was sent. The server
// re-resolves the recipient from the student id and refuses the send when the
// student is inactive or has no active portal account, so this UI never
// fabricates a successful delivery.
const SendStudentNotice = ({ student }) => {
  const { user } = useAuth();

  const [type, setType] = useState('General');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sentItems, setSentItems] = useState([]);
  const [serverRecipient, setServerRecipient] = useState(null);
  const [loadingRecipient, setLoadingRecipient] = useState(true);

  // Admin-only, matching the backend route and the notification engine's
  // authorization model (only an admin may address another principal). A
  // receptionist viewing the student workspace simply does not see this card.
  const canSend = user?.role === 'admin';

  // The real, server-resolved recipient. Delivery is only possible through the
  // student's own active portal account (there is no parent portal), so this is
  // fetched from the server rather than inferred from guardian contact fields.
  // State is only touched from the promise callbacks, never synchronously.
  useEffect(() => {
    if (!student?.studentId) return undefined;
    let cancelled = false;
    studentService
      .getNoticeRecipient(student.studentId)
      .then((response) => {
        if (!cancelled) setServerRecipient(response?.data || null);
      })
      .catch(() => {
        if (!cancelled) setServerRecipient(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingRecipient(false);
      });
    return () => {
      cancelled = true;
    };
  }, [student]);

  // Display falls back to the locally-derived guardian view while the server
  // value loads, but the send gate depends ONLY on the server's portal-account
  // answer (`null` means "not known yet", which also blocks sending).
  const localRecipient = getStudentNoticeRecipient(student);
  const recipient = {
    studentName: serverRecipient?.fullName || localRecipient?.studentName || '',
    className: serverRecipient?.className || localRecipient?.className || '',
    guardianName: serverRecipient?.guardianName ?? localRecipient?.guardianName ?? '',
    guardianPhone: serverRecipient?.guardianPhone ?? localRecipient?.guardianPhone ?? '',
    hasPortalAccount: serverRecipient ? Boolean(serverRecipient.hasPortalAccount) : null,
  };
  const canDeliver = recipient.hasPortalAccount === true;

  if (!student || !canSend) return null;

  const resetForm = () => {
    setType('General');
    setTitle('');
    setMessage('');
    setConfirming(false);
    setError('');
  };

  const handleReview = () => {
    const payload = buildStudentNoticePayload(student, { type, title, message });
    if (!payload) {
      setError('Enter a message before sending.');
      return;
    }
    setError('');
    setConfirming(true);
  };

  const handleSend = async () => {
    if (sending) return;

    const payload = buildStudentNoticePayload(student, { type, title, message });
    if (!payload) {
      setError('Enter a message before sending.');
      setConfirming(false);
      return;
    }

    setSending(true);
    setError('');
    try {
      const response = await studentService.sendStudentNotice(student.studentId, payload);
      const recipientInfo = response?.data?.recipient || {};
      setSentItems((items) => [
        {
          title: payload.title,
          type: payload.type,
          message: payload.message,
          at: new Date().toLocaleString('en-CA'),
        },
        ...items,
      ]);
      toast.success(`Notice sent to ${recipientInfo.fullName || student.fullName}'s student portal`);
      resetForm();
    } catch (err) {
      // The server returns a clear, honest reason (e.g. no active portal
      // account). Surface it instead of pretending the notice went out.
      setError(err?.response?.data?.message || 'Could not send the notice. Please try again.');
      setConfirming(false);
    } finally {
      setSending(false);
    }
  };

  return (
    <CardSection title="Send Notice / Reminder">
      <div className="space-y-4">
        {/* Single-target recipient summary, shown before sending. */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-3">
            <BellAlertIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Intended recipient (single student only)
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Student</p>
              <p className="font-semibold text-gray-900 dark:text-white">{recipient?.studentName || student.fullName}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{student.studentId}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Class</p>
              <p className="font-semibold text-gray-900 dark:text-white">{recipient?.className || student.class || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Guardian on file</p>
              <p className="font-semibold text-gray-900 dark:text-white">{recipient?.guardianName || '-'}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{recipient?.guardianPhone || 'No phone on file'}</p>
            </div>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mt-3">
            <ShieldCheckIcon className="h-3.5 w-3.5" />
            Delivered to: <span className="font-medium">In-app notification (this student's portal inbox)</span>
            {recipient.hasPortalAccount === false && (
              <span className="text-red-600 dark:text-red-400 font-medium ml-1">
                (Portal account not available)
              </span>
            )}
          </p>
        </div>

        {loadingRecipient ? (
          <Alert type="info" message="Checking whether this student can receive an in-app notice…" />
        ) : recipient.hasPortalAccount === false ? (
          <Alert
            type="warning"
            message="This student has no active portal account, so an in-app notice cannot be delivered. Open the student portal first, then try again."
          />
        ) : null}

        {error ? <Alert type="error" message={error} /> : null}

        {confirming ? (
          <div className="rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/20 p-4">
            <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">
              Confirm before sending
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-300">
              This notice will be sent only to <strong>{student.fullName} ({student.studentId})</strong>.
            </p>
            <div className="mt-3 text-sm space-y-1">
              <p><span className="text-gray-500 dark:text-gray-400">Type:</span> <span className="font-medium">{type}</span></p>
              <p><span className="text-gray-500 dark:text-gray-400">Title:</span> <span className="font-medium">{title.trim() || type}</span></p>
              <p className="text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{message}</p>
            </div>
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={sending}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all cursor-pointer disabled:opacity-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || !canDeliver}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PaperAirplaneIcon className="h-4 w-4" />
                {sending ? 'Sending...' : 'Confirm & Send'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="noticeType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Notice Type
                </label>
                <select
                  id="noticeType"
                  name="noticeType"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="appearance-none w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                >
                  {NOTICE_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <Input
                label="Title (optional)"
                name="noticeTitle"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Defaults to the notice type"
              />
            </div>

            <div>
              <label htmlFor="noticeMessage" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Message <span className="text-red-500">*</span>
              </label>
              <textarea
                id="noticeMessage"
                name="noticeMessage"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="Type the notice or reminder to send to this student."
                className="appearance-none block w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all bg-white dark:bg-gray-800 dark:text-white resize-none"
              />
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500 text-right">{message.length}/2000</p>
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <PhoneIcon className="h-3.5 w-3.5" />
                SMS / WhatsApp / email are not configured in this build - only the student portal inbox is delivered to.
              </p>
              <button
                type="button"
                onClick={handleReview}
                disabled={!canDeliver || !message.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                <PaperAirplaneIcon className="h-4 w-4" />
                Review &amp; Send
              </button>
            </div>
          </>
        )}

        {sentItems.length > 0 && (
          <div className="pt-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
              Sent in this session
            </p>
            <ul className="space-y-2">
              {sentItems.map((item, index) => (
                <li
                  key={`${item.at}-${index}`}
                  className="flex items-start gap-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg p-3"
                >
                  <CheckCircleIcon className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">{item.title} · {item.type}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{item.at}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </CardSection>
  );
};

export default SendStudentNotice;
