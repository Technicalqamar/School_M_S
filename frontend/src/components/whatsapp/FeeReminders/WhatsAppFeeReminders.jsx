import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  PaperAirplaneIcon,
  QuestionMarkCircleIcon,
  UserGroupIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import CardSection from '../../common/CardSection/CardSection';
import SelectInput from '../../common/SelectInput/SelectInput';
import Input from '../../common/Input/Input';
import Alert from '../../common/Alert/Alert';
import Spinner from '../../common/Spinner/Spinner';
import ClassSelector from '../../communication/ClassSelector';
import { useSchoolConfig } from '../../../contexts/SchoolConfigContext';
import { useAcademicYear } from '../../../utils/academicYear';
import {
  DEFAULT_FEE_REMINDER_TEMPLATE,
  FEE_REMINDER_PLACEHOLDERS,
  renderFeeReminderMessage,
} from '../../../utils/feeReminderTemplate';
import {
  MAX_WHATSAPP_REMINDER_RECIPIENTS,
  WHATSAPP_REASON_META,
  WHATSAPP_TABS,
  buildSendRequest,
  formatWhatsAppNumber,
  getEligibleRecipients,
  getRecipientListState,
  getReviewState,
  isWhatsAppConnected,
  selectAllEligible,
  summarizeWhatsAppMessage,
  toggleRecipientSelection,
} from '../../../utils/whatsappFeeReminders';
import schoolSettingsService from '../../../services/schoolSettings/schoolSettings.service';
import whatsappFeeReminderService from '../../../services/whatsapp/whatsappFeeReminder.service';
import WhatsAppAssignments from '../Assignments/WhatsAppAssignments';

const formatCurrency = (value) => `Rs. ${Number(value || 0).toLocaleString()}`;

const DEFAULT_STATUS = {
  configured: false,
  status: 'not_configured',
  connectedNumber: '',
  tokenHint: '',
  lastCheckedAt: null,
};

const STATUS_META = {
  not_configured: {
    label: 'Not configured',
    badge: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    Icon: InformationCircleIcon,
    description: 'No WhatsApp API token is saved yet. Add one in Settings before sending reminders.',
  },
  connected: {
    label: 'Connected',
    badge: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    Icon: CheckCircleIcon,
    description: 'The provider confirmed an active WhatsApp session. Sending is available.',
  },
  disconnected: {
    label: 'Disconnected',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    Icon: XCircleIcon,
    description: 'The token is saved but the provider reports no active WhatsApp session. Sending is disabled.',
  },
  unknown: {
    label: 'Unknown',
    badge: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    Icon: QuestionMarkCircleIcon,
    description: 'The connection state could not be determined. It is never treated as connected.',
  },
  check_failed: {
    label: 'Connection check failed',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    Icon: ExclamationTriangleIcon,
    description: 'The last connection check failed. Verify the token in Settings and retry the check.',
  },
};

const RESULT_META = {
  sent: {
    label: 'Sent',
    badge: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300',
  },
  skipped: {
    label: 'Skipped',
    badge: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300',
  },
  failed: {
    label: 'Failed',
    badge: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',
  },
  pending: {
    label: 'Pending',
    badge: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  },
};

const REASON_BADGE = {
  green: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300',
  amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300',
  gray: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
};

const formatCheckedAt = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
};

const FeeRemindersTab = () => {
  const { academic } = useSchoolConfig();
  const { year, setYear, options: yearOptions } = useAcademicYear(academic?.currentYear);

  const [selectedClasses, setSelectedClasses] = useState([]);
  const [search, setSearch] = useState('');

  const [recipients, setRecipients] = useState([]);
  const [maxRecipients, setMaxRecipients] = useState(MAX_WHATSAPP_REMINDER_RECIPIENTS);
  const [defaultTemplate, setDefaultTemplate] = useState(DEFAULT_FEE_REMINDER_TEMPLATE);
  const [messageTemplate, setMessageTemplate] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [status, setStatus] = useState(DEFAULT_STATUS);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState('');

  const [selectedIds, setSelectedIds] = useState([]);
  const [reviewing, setReviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const [sendError, setSendError] = useState('');
  const [result, setResult] = useState(null);
  const [resultStudents, setResultStudents] = useState({});

  const fetchStatus = useCallback(async () => {
    try {
      const response = await schoolSettingsService.getWhatsAppSettings();
      setStatus({ ...DEFAULT_STATUS, ...(response?.data || {}) });
      setStatusError('');
    } catch (error) {
      setStatusError(error?.response?.data?.message || 'Failed to load the WhatsApp connection status.');
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    // The async loader owns its loading state; this mirrors the existing
    // WhatsApp settings tab and keeps the effect free of synchronous setState.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchStatus();
  }, [fetchStatus]);

  const fetchRecipients = useCallback(
    () =>
      whatsappFeeReminderService.getRecipients({
        classNames: selectedClasses,
        academicYear: year,
        search: search.trim() || undefined,
      }),
    [selectedClasses, year, search],
  );

  useEffect(() => {
    let cancelled = false;
    fetchRecipients()
      .then((data) => {
        if (cancelled) return;
        setRecipients(Array.isArray(data?.recipients) ? data.recipients : []);
        setMaxRecipients(data?.maxRecipients || MAX_WHATSAPP_REMINDER_RECIPIENTS);
        if (data?.defaultTemplate) {
          setDefaultTemplate(data.defaultTemplate);
          setMessageTemplate((current) => current || data.defaultTemplate);
        }
        setSelectedIds([]);
        setReviewing(false);
        setSendError('');
        setResult(null);
        setLoadError('');
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(
          error?.response?.data?.message || 'Failed to load students with outstanding WhatsApp reminders.',
        );
        setRecipients([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fetchRecipients]);

  const isConnected = isWhatsAppConnected(status);
  const eligibleRecipients = useMemo(() => getEligibleRecipients(recipients), [recipients]);
  const selectedRecipients = useMemo(
    () => recipients.filter((recipient) => selectedIds.includes(recipient.studentId)),
    [recipients, selectedIds],
  );
  const selectedCount = selectedIds.length;
  const totalOutstanding = useMemo(
    () => recipients.reduce((sum, recipient) => sum + Number(recipient.totalOutstanding || 0), 0),
    [recipients],
  );
  const missingWhatsAppCount = recipients.filter(
    (recipient) => recipient.reason === 'missing_whatsapp',
  ).length;
  const listState = getRecipientListState({ loading, error: loadError, recipients });
  const reviewState = getReviewState({
    isConnected,
    selectedCount,
    messageTemplate,
    sending,
  });
  const sampleRecipient = selectedRecipients[0] || eligibleRecipients[0] || recipients[0] || null;
  const samplePreview = sampleRecipient
    ? renderFeeReminderMessage(messageTemplate, sampleRecipient.context || {})
    : '';
  const statusMeta = STATUS_META[status.status] || STATUS_META.unknown;
  const StatusIcon = statusMeta.Icon;
  const checkedAt = formatCheckedAt(status.lastCheckedAt);
  const allEligibleSelected =
    eligibleRecipients.length > 0 &&
    eligibleRecipients.every((recipient) => selectedIds.includes(recipient.studentId));

  const resetReview = () => {
    setReviewing(false);
    setSendError('');
    setResult(null);
  };

  const markFilterLoading = () => {
    setLoading(true);
    setLoadError('');
    setSelectedIds([]);
    setReviewing(false);
    setSendError('');
    setResult(null);
  };

  const handleYearChange = (event) => {
    setYear(event.target.value);
    markFilterLoading();
  };

  const handleClassesChange = (next) => {
    setSelectedClasses(next);
    markFilterLoading();
  };

  const handleSearchChange = (event) => {
    setSearch(event.target.value);
    markFilterLoading();
  };

  const handleToggleRecipient = (studentId) => {
    const outcome = toggleRecipientSelection(selectedIds, studentId, recipients, maxRecipients);
    if (outcome.limited) {
      toast.error(`You can send at most ${maxRecipients} WhatsApp reminders at once.`);
      return;
    }
    if (outcome.ineligible || !outcome.changed) return;
    setSelectedIds(outcome.ids);
    resetReview();
  };

  const handleSelectAll = () => {
    const selection = selectAllEligible(recipients, maxRecipients);
    setSelectedIds(selection.ids);
    resetReview();
    if (selection.truncated) {
      toast.error(
        `Only the first ${maxRecipients} of ${selection.totalEligible} eligible students were selected. Send in smaller batches.`,
      );
    }
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
    resetReview();
  };

  const handleTemplateChange = (event) => {
    setMessageTemplate(event.target.value);
    resetReview();
  };

  const handleReview = () => {
    if (!reviewState.canReview) {
      toast.error(reviewState.reason);
      return;
    }
    setReviewing(true);
    setSendError('');
    setResult(null);
  };

  const handleSend = async () => {
    if (sendingRef.current) return;
    if (!reviewState.canReview) {
      toast.error(reviewState.reason);
      return;
    }

    const request = buildSendRequest({
      studentIds: selectedIds,
      academicYear: year,
      messageTemplate,
    });
    if (!request.studentIds.length) {
      toast.error('Select at least one eligible student.');
      return;
    }

    const snapshot = Object.fromEntries(
      selectedRecipients.map((recipient) => [
        recipient.studentId,
        {
          fullName: recipient.fullName,
          className: recipient.className,
          whatsappNumber: recipient.whatsappNumber,
          totalOutstanding: recipient.totalOutstanding,
        },
      ]),
    );

    sendingRef.current = true;
    setSending(true);
    setSendError('');
    try {
      const data = await whatsappFeeReminderService.sendReminders(request);
      setResult(data);
      setResultStudents(snapshot);
      setReviewing(false);
      setSelectedIds([]);
      toast.success(
        `WhatsApp reminders processed - sent: ${data.sent}, skipped: ${data.skipped}, failed: ${data.failed}`,
      );
      if (data.failed > 0) {
        toast.error('Some reminders could not be sent. Review the per-recipient results below.');
      }
    } catch (error) {
      const message =
        error?.response?.data?.message || 'Failed to send WhatsApp reminders. Please try again.';
      setSendError(message);
      setResult(null);
      setReviewing(false);
      // A request that failed after the server started may have contacted some
      // guardians. Clear the selection so a hasty retry cannot duplicate sends.
      setSelectedIds([]);
      toast.error(message);
      fetchStatus();
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const resultRows = (result?.results || []).map((row) => ({
    ...row,
    ...(resultStudents[row.studentId] || {}),
  }));

  return (
    <div className="space-y-6">
      <CardSection title="WhatsApp Connection">
        {statusLoading ? (
          <div className="flex items-center justify-center py-6">
            <Spinner size="md" className="text-blue-600" />
          </div>
        ) : (
          <div className="space-y-3">
            {statusError ? <Alert type="error" message={statusError} /> : null}

            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${statusMeta.badge}`}
              >
                <StatusIcon className="h-4 w-4" />
                {statusMeta.label}
              </span>
              {status.connectedNumber ? (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Connected number: {formatWhatsAppNumber(status.connectedNumber)}
                </span>
              ) : null}
              <Link
                to="/admin/settings"
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                Open Settings → WhatsApp
              </Link>
              <button
                type="button"
                onClick={() => {
                  setStatusLoading(true);
                  fetchStatus();
                }}
                className="text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
              >
                Refresh status
              </button>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400">
              {status.status === 'unknown' && !checkedAt
                ? 'The connection has not been checked yet. Run a connection test in Settings → WhatsApp.'
                : statusMeta.description}
            </p>

            {!isConnected ? (
              <Alert
                type="warning"
                message="Sending is disabled until Settings → WhatsApp reports an explicit Connected status."
              />
            ) : null}
          </div>
        )}
      </CardSection>

      <CardSection title="Reminder Target">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SelectInput
            label="Academic Year"
            name="whatsappAcademicYear"
            value={year}
            onChange={handleYearChange}
            options={yearOptions}
            placeholder="Select year"
          />
          <Input
            label="Search (optional)"
            name="whatsappSearch"
            value={search}
            onChange={handleSearchChange}
            placeholder="Student name or Student ID"
          />
        </div>

        <div className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              Classes{' '}
              <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                ({selectedClasses.length ? `${selectedClasses.length} selected` : 'all classes'})
              </span>
            </span>
            {selectedClasses.length > 0 ? (
              <button
                type="button"
                onClick={() => handleClassesChange([])}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Clear classes
              </button>
            ) : null}
          </div>
          <ClassSelector value={selectedClasses} onChange={handleClassesChange} disabled={loading} />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Leave every class unchecked to include all classes.
          </p>
        </div>

        {loadError ? <div className="mt-3"><Alert type="error" message={loadError} /></div> : null}

        {!loading && !loadError ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <UserGroupIcon className="h-3.5 w-3.5" /> Eligible
              </p>
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                {eligibleRecipients.length}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Missing WhatsApp</p>
              <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
                {missingWhatsAppCount}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Selected</p>
              <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{selectedCount}</p>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Total outstanding</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {formatCurrency(totalOutstanding)}
              </p>
            </div>
          </div>
        ) : null}
      </CardSection>

      <CardSection title="Message Template">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {FEE_REMINDER_PLACEHOLDERS.map((token) => (
              <button
                key={token}
                type="button"
                onClick={() => {
                  setMessageTemplate(
                    (current) => `${current}${current.endsWith(' ') || !current ? '' : ' '}${token}`,
                  );
                  resetReview();
                }}
                className="px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-xs font-mono text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
              >
                {token}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setMessageTemplate(defaultTemplate);
                resetReview();
              }}
              className="px-2 py-1 rounded-md border border-gray-300 dark:border-gray-600 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
            >
              Reset to default
            </button>
          </div>
          <textarea
            value={messageTemplate}
            onChange={handleTemplateChange}
            rows={4}
            disabled={sending}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-60"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Every placeholder is filled in by the server from the current ledger. A balance is never
            accepted from this page.
          </p>
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-900/40">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
              Preview
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">
              {samplePreview ||
                summarizeWhatsAppMessage(messageTemplate) ||
                'Select an eligible student to preview the WhatsApp message.'}
            </p>
          </div>
        </div>
      </CardSection>

      <CardSection title="Students With Outstanding Dues">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {loading
              ? 'Loading students...'
              : `${recipients.length} student${recipients.length === 1 ? '' : 's'} with outstanding dues · ${eligibleRecipients.length} eligible for WhatsApp`}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAll}
              disabled={loading || !eligibleRecipients.length}
              className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Select all eligible
            </button>
            <button
              type="button"
              onClick={handleClearSelection}
              disabled={!selectedCount}
              className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Clear selection
            </button>
          </div>
        </div>

        {listState === 'loading' ? (
          <div className="flex justify-center py-10">
            <Spinner size="md" className="text-blue-600" />
          </div>
        ) : listState === 'error' ? (
          <Alert type="error" message={loadError} />
        ) : listState === 'empty' ? (
          <div className="flex items-center gap-2 justify-center py-8 text-sm text-gray-500 dark:text-gray-400">
            <CheckCircleIcon className="h-5 w-5 text-emerald-500" />
            No students with outstanding dues match these filters.
          </div>
        ) : (
          <>
            {listState === 'no-eligible' ? (
              <Alert
                type="warning"
                message="These students have outstanding dues, but none has an active student record with a valid dedicated WhatsApp number."
              />
            ) : null}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                    <th className="py-2 pr-3 w-10">
                      <span className="sr-only">Select</span>
                    </th>
                    <th className="py-2 pr-3">Student</th>
                    <th className="py-2 pr-3">Class</th>
                    <th className="py-2 pr-3 text-right">Outstanding</th>
                    <th className="py-2 pr-3">Guardian WhatsApp</th>
                    <th className="py-2 pr-3">Eligibility</th>
                  </tr>
                </thead>
                <tbody>
                  {recipients.map((recipient) => {
                    const checked = selectedIds.includes(recipient.studentId);
                    const reasonMeta = WHATSAPP_REASON_META[recipient.reason] || {
                      label: recipient.reason || 'Not eligible',
                      tone: 'gray',
                    };
                    return (
                      <tr
                        key={recipient.studentId}
                        className="border-b border-gray-50 dark:border-gray-800"
                      >
                        <td className="py-2 pr-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!recipient.eligible || sending}
                            onChange={() => handleToggleRecipient(recipient.studentId)}
                            aria-label={`Select ${recipient.fullName || recipient.studentId}`}
                            className="h-4 w-4 text-blue-600 rounded disabled:opacity-40"
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <p className="font-medium text-gray-900 dark:text-white">
                            {recipient.fullName}
                          </p>
                          <p className="text-xs font-mono text-gray-500 dark:text-gray-400">
                            {recipient.studentId}
                          </p>
                        </td>
                        <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">
                          {recipient.className}
                        </td>
                        <td className="py-2 pr-3 text-right font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(recipient.totalOutstanding)}
                        </td>
                        <td className="py-2 pr-3">
                          <span
                            className={
                              recipient.whatsappNumber
                                ? 'text-gray-700 dark:text-gray-200'
                                : 'text-amber-600 dark:text-amber-400'
                            }
                          >
                            {formatWhatsAppNumber(recipient.whatsappNumber)}
                          </span>
                        </td>
                        <td className="py-2 pr-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              REASON_BADGE[reasonMeta.tone] || REASON_BADGE.gray
                            }`}
                          >
                            {reasonMeta.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 flex items-start gap-1.5">
            <ExclamationTriangleIcon className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
            Sending may contact a real guardian. Only students with an active record, a valid
            dedicated WhatsApp number and a positive outstanding balance are selectable.
          </p>
          <button
            type="button"
            onClick={handleReview}
            disabled={!reviewState.canReview}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PaperAirplaneIcon className="h-4 w-4" />
            {allEligibleSelected ? 'Review all selected' : `Review ${selectedCount || ''} reminders`}
          </button>
        </div>
        {!reviewState.canReview && selectedCount > 0 ? (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">{reviewState.reason}</p>
        ) : null}
      </CardSection>

      {reviewing ? (
        <CardSection title="Review WhatsApp Reminders">
          <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3 mb-4">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
              <ExclamationTriangleIcon className="h-4 w-4" />
              You are about to contact {selectedCount} real guardian
              {selectedCount === 1 ? '' : 's'} on WhatsApp.
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
              &quot;Sent&quot; means the WhatsApp provider accepted the message. It is not proof that
              the message was delivered or read.
            </p>
          </div>

          {sendError ? <Alert type="error" message={sendError} /> : null}

          <div className="space-y-2 mb-4">
            {selectedRecipients.map((recipient) => (
              <div
                key={recipient.studentId}
                className="rounded-lg border border-gray-200 dark:border-gray-700 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {recipient.fullName}{' '}
                      <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                        ({recipient.className})
                      </span>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Destination: {formatWhatsAppNumber(recipient.whatsappNumber)}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(recipient.totalOutstanding)}
                  </p>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap mt-2">
                  {renderFeeReminderMessage(messageTemplate, recipient.context || {})}
                </p>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
            <button
              type="button"
              onClick={() => setReviewing(false)}
              disabled={sending}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || !isConnected || selectedCount === 0}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <PaperAirplaneIcon className="h-4 w-4" />
              {sending ? 'Sending...' : `Confirm and send to ${selectedCount}`}
            </button>
          </div>
          {sending ? (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-right">
              Please wait. The request is in progress and cannot be submitted twice.
            </p>
          ) : null}
        </CardSection>
      ) : null}

      {result ? (
        <CardSection title="Last Send Result">
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Sent (provider accepted)</p>
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{result.sent}</p>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Skipped</p>
              <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{result.skipped}</p>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Failed</p>
              <p className="text-lg font-bold text-red-600 dark:text-red-400">{result.failed}</p>
            </div>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Per-recipient results. A sent message is provider acceptance only, not delivery
            confirmation.
          </p>

          <div className="space-y-2">
            {resultRows.map((row) => {
              const meta = RESULT_META[row.status] || RESULT_META.pending;
              return (
                <div
                  key={row.studentId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {row.fullName || row.studentId}{' '}
                      <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                        {row.studentId}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {row.className ? `${row.className} · ` : ''}
                      {row.whatsappNumber ? formatWhatsAppNumber(row.whatsappNumber) : 'No destination'}
                      {row.reason ? ` · ${row.reason}` : ''}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${meta.badge}`}
                  >
                    {meta.label}
                  </span>
                </div>
              );
            })}
          </div>
        </CardSection>
      ) : null}
    </div>
  );
};

// Single-school WhatsApp module. The working fee-reminder workflow lives under
// the "Fee Reminders" tab and the not-yet-implemented work lives under
// "Assignments". Tab chrome reuses the module tab styling already used by
// PayrollManagement and SchoolSettings.
const WhatsAppFeeReminders = () => {
  const [activeTab, setActiveTab] = useState(WHATSAPP_TABS[0].key);
  const currentTab = WHATSAPP_TABS.some((tab) => tab.key === activeTab)
    ? activeTab
    : WHATSAPP_TABS[0].key;

  // The admin shell keeps one scroll container (the layout's <main>). Reset it
  // when switching sections so the new tab always starts at its heading instead
  // of inheriting the previous tab's scroll offset.
  useEffect(() => {
    const main = document.querySelector('main');
    if (main) {
      main.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
  }, [currentTab]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
          <ChatBubbleLeftRightIcon className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          WhatsApp Reminder
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Send guardians a WhatsApp reminder about outstanding fees. Balances are recalculated from
          the fee ledger on the server immediately before each message is sent.
        </p>
      </div>

      <div className="border-b border-gray-200 overflow-x-auto dark:border-gray-700">
        <nav className="flex min-w-max gap-1" aria-label="WhatsApp Reminder sections">
          {WHATSAPP_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              aria-current={currentTab === tab.key ? 'page' : undefined}
              className={`cursor-pointer border-b-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all ${
                currentTab === tab.key
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {currentTab === 'assignments' ? <WhatsAppAssignments /> : <FeeRemindersTab />}
    </div>
  );
};

export default WhatsAppFeeReminders;
