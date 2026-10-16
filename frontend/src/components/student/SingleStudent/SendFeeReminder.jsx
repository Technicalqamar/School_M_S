import { useState, useEffect } from 'react';
import {
  BellAlertIcon,
  PaperAirplaneIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import CardSection from '../../common/CardSection/CardSection';
import Alert from '../../common/Alert/Alert';
import Spinner from '../../common/Spinner/Spinner';
import feeReminderService from '../../../services/fee/feeReminder.service';
import {
  DEFAULT_FEE_REMINDER_TEMPLATE,
  FEE_REMINDER_PLACEHOLDERS,
  renderFeeReminderMessage,
} from '../../../utils/feeReminderTemplate';

const formatCurrency = (val) => `Rs. ${Number(val || 0).toLocaleString()}`;

// Direct "Send Fee Reminder" action for the selected student, shown on the
// Single Student Management Fees page.
//
// It shares the exact same backend reminder service as the class-wise Fee
// Reminders page (`feeReminder.service.js`), so a student can never be reminded
// two different ways. The outstanding balance and recipient eligibility shown
// here come from the server (real fee ledger + active portal account) and are
// re-validated again server-side at send time; the client only composes the
// message. Sending is blocked with a clear explanation when there is no
// outstanding balance or no active portal account.
const SendFeeReminder = ({ student }) => {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [context, setContext] = useState(null);
  const [messageTemplate, setMessageTemplate] = useState(DEFAULT_FEE_REMINDER_TEMPLATE);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [lastResult, setLastResult] = useState(null);

  // The live balance/recipient context, re-read from the server. State is only
  // touched from the promise callbacks, never synchronously inside the effect;
  // the parent remounts this component (via `key`) when the student changes, so
  // no manual reset is needed here.
  useEffect(() => {
    if (!student?.studentId) return undefined;
    let cancelled = false;
    feeReminderService
      .getStudentContext(student.studentId)
      .then((data) => {
        if (cancelled) return;
        setContext(data);
        if (data?.defaultTemplate) setMessageTemplate(data.defaultTemplate);
        setLoadError('');
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err?.response?.data?.message || 'Could not load this student’s fee details.');
        setContext(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [student]);

  if (!student) return null;

  const outstanding = Number(context?.totalOutstanding || 0);
  const hasBalance = outstanding > 0;
  const hasAccount = Boolean(context?.hasPortalAccount);
  const canSend = hasBalance && hasAccount && messageTemplate.trim().length > 0;
  const preview = renderFeeReminderMessage(messageTemplate, context?.context || {});

  const handleSend = async () => {
    setSending(true);
    setError('');
    try {
      const data = await feeReminderService.sendStudentReminder(student.studentId, {
        messageTemplate: messageTemplate.trim(),
      });
      setLastResult(data);
      setConfirming(false);
      toast.success(`Fee reminder sent to ${student.fullName || 'the student'}’s portal`);
      // Re-read so the displayed balance reflects the latest ledger. Runs in the
      // submit handler (not an effect), so setting loading here is fine.
      setLoading(true);
      feeReminderService
        .getStudentContext(student.studentId)
        .then((fresh) => {
          setContext(fresh);
          setLoadError('');
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not send the fee reminder. Please try again.');
      setConfirming(false);
    } finally {
      setSending(false);
    }
  };

  return (
    <CardSection title="Send Fee Reminder">
      <div className="space-y-4">
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-xs text-gray-600 dark:text-gray-300 space-y-1">
          <p>
            <span className="text-gray-500 dark:text-gray-400">Student:</span>{' '}
            <span className="font-medium text-gray-800 dark:text-gray-100">{student.fullName}</span>{' '}
            ({student.studentId}) — Class {student.class}
          </p>
          <p>
            <span className="text-gray-500 dark:text-gray-400">Outstanding balance:</span>{' '}
            {loading ? '…' : <span className="font-semibold">{formatCurrency(outstanding)}</span>}
          </p>
          <p className="flex items-center gap-1.5">
            <ShieldCheckIcon className="h-3.5 w-3.5" />
            Delivered to: <span className="font-medium">In-app notification (this student’s portal inbox)</span>
            {!loading && !hasAccount && (
              <span className="text-red-600 dark:text-red-400 font-medium ml-1">
                (Portal account not available)
              </span>
            )}
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : loadError ? (
          <Alert type="error" message={loadError} />
        ) : (
          <>
            {!hasBalance ? (
              <Alert
                type="info"
                message="This student has no outstanding dues, so no fee reminder is needed."
              />
            ) : null}

            {hasBalance && !hasAccount ? (
              <Alert
                type="warning"
                message="This student has outstanding dues but no active portal account, so an in-app reminder cannot be delivered. Open the student portal first, then try again."
              />
            ) : null}

            {hasBalance && hasAccount ? (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {FEE_REMINDER_PLACEHOLDERS.map((token) => (
                    <button
                      key={token}
                      type="button"
                      onClick={() =>
                        setMessageTemplate((t) => `${t}${t.endsWith(' ') || !t ? '' : ' '}${token}`)
                      }
                      className="px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-xs font-mono text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                    >
                      {token}
                    </button>
                  ))}
                </div>
                <textarea
                  value={messageTemplate}
                  onChange={(e) => setMessageTemplate(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-900/40">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                    Preview
                  </p>
                  <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">
                    {preview || '—'}
                  </p>
                </div>
              </>
            ) : null}

            {error ? <Alert type="error" message={error} /> : null}

            {confirming ? (
              <div className="rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/20 p-4">
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-1.5">
                  <ExclamationTriangleIcon className="h-4 w-4" />
                  Confirm before sending
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  This reminder will be sent only to{' '}
                  <strong>
                    {student.fullName} ({student.studentId})
                  </strong>{' '}
                  for the outstanding balance of <strong>{formatCurrency(outstanding)}</strong>.
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    disabled={sending}
                    className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={sending}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <PaperAirplaneIcon className="h-4 w-4" />
                    {sending ? 'Sending...' : 'Confirm & Send'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                disabled={!canSend}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <BellAlertIcon className="h-4 w-4" />
                Send Fee Reminder
              </button>
            )}

            {lastResult ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Last reminder outcome: {lastResult.created === false ? 'already recorded (no duplicate)' : 'created'}
              </p>
            ) : null}
          </>
        )}
      </div>
    </CardSection>
  );
};

export default SendFeeReminder;
