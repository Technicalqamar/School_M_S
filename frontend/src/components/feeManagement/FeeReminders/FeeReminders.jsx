import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  BellAlertIcon,
  MegaphoneIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  UserGroupIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import CardSection from '../../common/CardSection/CardSection';
import SelectInput from '../../common/SelectInput/SelectInput';
import Input from '../../common/Input/Input';
import Alert from '../../common/Alert/Alert';
import Spinner from '../../common/Spinner/Spinner';
import ClassSelector from '../../communication/ClassSelector';
import feeReminderService from '../../../services/fee/feeReminder.service';
import { useSchoolConfig } from '../../../contexts/SchoolConfigContext';
import { CLASS_NAMES } from '../../../utils/classNames';
import { useAcademicYear } from '../../../utils/academicYear';
import {
  DEFAULT_FEE_REMINDER_TEMPLATE,
  FEE_REMINDER_PLACEHOLDERS,
  renderFeeReminderMessage,
} from '../../../utils/feeReminderTemplate';

const formatCurrency = (val) => `Rs. ${Number(val || 0).toLocaleString()}`;

const ALL_CLASSES = [...CLASS_NAMES];

// Class-wise Fee Reminders.
//
// The page targets one OR MORE classes (a student belongs to a single class, so
// multi-class simply unions the eligible students). Eligibility and every balance
// come from the real fee ledger on the server; the list here is only a preview and
// the server re-validates the requested classes and each recipient's balance
// immediately before writing a reminder, so a student who has since paid is
// skipped rather than reminded and the same student is never reminded twice in one
// send.
const FeeReminders = () => {
  const { academic } = useSchoolConfig();
  const { year, setYear, options: yearOptions } = useAcademicYear(academic?.currentYear);

  const [selectedClasses, setSelectedClasses] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [recipients, setRecipients] = useState([]);
  const [messageTemplate, setMessageTemplate] = useState(DEFAULT_FEE_REMINDER_TEMPLATE);

  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  // A primitive key rather than the array itself: an array prop/state changes
  // identity on every render and would re-run the fetch effect needlessly. The
  // key only changes when the actual selection changes.
  const classNamesKey = selectedClasses.join(',');
  const selectedCount = selectedClasses.length;
  const allSelected = selectedCount === ALL_CLASSES.length;

  const selectAllRef = useRef(null);
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selectedCount > 0 && !allSelected;
    }
  }, [selectedCount, allSelected]);

  // A pure fetch (no setState), so an effect can call it without triggering the
  // "no synchronous setState inside an effect" rule; every state update happens
  // in the promise callbacks. Reused by the post-send refresh.
  const fetchRecipients = useCallback(
    () =>
      feeReminderService.getRecipients({
        classNames: classNamesKey ? classNamesKey.split(',') : [],
        academicYear: year,
        search: search.trim() || undefined,
      }),
    [classNamesKey, year, search],
  );

  // Applies a fresh recipient list. Shared by the effect and the post-send
  // refresh so both go through exactly one code path.
  const applyRecipients = useCallback((data) => {
    setRecipients(data?.eligible || []);
    if (data?.defaultTemplate) {
      setMessageTemplate((current) => current || data.defaultTemplate);
    }
    setLoadError('');
  }, []);

  useEffect(() => {
    if (!classNamesKey) return undefined;
    let cancelled = false;
    fetchRecipients()
      .then((data) => {
        if (cancelled) return;
        applyRecipients(data);
        setResult(null);
        setConfirming(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err?.response?.data?.message || 'Failed to load fee reminder recipients.');
        setRecipients([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchRecipients, applyRecipients, classNamesKey]);

  const handleClassesChange = useCallback((next) => {
    setSelectedClasses(next);
    setRecipients([]);
    setResult(null);
    setConfirming(false);
    setLoadError('');
    setLoading(next.length > 0);
  }, []);

  const handleToggleAll = useCallback(() => {
    const next = selectedCount === ALL_CLASSES.length ? [] : [...ALL_CLASSES];
    handleClassesChange(next);
  }, [selectedCount, handleClassesChange]);

  const previewFor = useCallback(
    (recipient) => renderFeeReminderMessage(messageTemplate, recipient.context || {}),
    [messageTemplate],
  );

  const withAccount = useMemo(
    () => recipients.filter((r) => r.hasPortalAccount),
    [recipients],
  );

  const totalOutstanding = useMemo(
    () => recipients.reduce((sum, r) => sum + Number(r.totalOutstanding || 0), 0),
    [recipients],
  );

  const samplePreview = recipients.length ? previewFor(recipients[0]) : '';

  const handleSend = async () => {
    if (!selectedCount || !messageTemplate.trim()) return;
    setSending(true);
    try {
      const data = await feeReminderService.sendClassReminders({
        classNames: selectedClasses,
        academicYear: year,
        messageTemplate: messageTemplate.trim(),
      });
      setResult(data);
      setConfirming(false);
      toast.success(
        `Fee reminders processed — sent: ${data.sent}, skipped: ${data.skipped}, failed: ${data.failed}`,
      );
      // Reload so the eligible list reflects who just received a reminder. This
      // runs in the submit handler (not an effect), so the loading state is fine.
      setLoading(true);
      fetchRecipients()
        .then((fresh) => applyRecipients(fresh))
        .catch(() => {})
        .finally(() => setLoading(false));
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to send fee reminders.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="pb-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <BellAlertIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          Fee Reminders
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Send a fee reminder to students with outstanding dues in one or more classes. Only students
          with a real outstanding balance and an active student portal account are reminded; the
          message is delivered to each student&apos;s own portal inbox.
        </p>
      </div>

      <CardSection title="Reminder Target">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SelectInput
            label="Academic Year"
            name="academicYear"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            options={yearOptions}
            placeholder="Select year"
          />
          <Input
            label="Search (optional)"
            name="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name or Student ID"
          />
        </div>

        <div className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              Classes{' '}
              <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                ({selectedCount} of {ALL_CLASSES.length} selected)
              </span>
            </span>
            <label className="flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-300 cursor-pointer select-none">
              <input
                ref={selectAllRef}
                type="checkbox"
                checked={allSelected}
                onChange={handleToggleAll}
                className="h-4 w-4 text-blue-600 rounded"
              />
              Select All
            </label>
          </div>
          <ClassSelector value={selectedClasses} onChange={handleClassesChange} />
        </div>

        {loadError ? <div className="mt-3"><Alert type="error" message={loadError} /></div> : null}

        {selectedCount > 0 && !loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <UserGroupIcon className="h-3.5 w-3.5" /> Eligible students
              </p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{recipients.length}</p>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">With portal account</p>
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{withAccount.length}</p>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Without portal account</p>
              <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
                {recipients.length - withAccount.length}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Total outstanding</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(totalOutstanding)}</p>
            </div>
          </div>
        ) : null}
      </CardSection>

      <CardSection title="Message">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {FEE_REMINDER_PLACEHOLDERS.map((token) => (
              <button
                key={token}
                type="button"
                onClick={() => setMessageTemplate((t) => `${t}${t.endsWith(' ') || !t ? '' : ' '}${token}`)}
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
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Each recipient&apos;s own name, class, outstanding balance and fee period are filled in
            server-side when the reminder is sent — a balance is never edited into the message from the client.
          </p>
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-900/40">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
              Preview (first eligible recipient)
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">
              {samplePreview || 'Select one or more classes with outstanding dues to preview the message.'}
            </p>
          </div>
        </div>
      </CardSection>

      <CardSection title="Eligible Recipients">
        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : selectedCount === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">
            Select one or more classes to list the students with outstanding dues.
          </p>
        ) : recipients.length === 0 ? (
          <div className="flex items-center gap-2 justify-center py-8 text-sm text-gray-500 dark:text-gray-400">
            <CheckCircleIcon className="h-5 w-5 text-emerald-500" />
            No students in the selected classes have outstanding dues.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                  <th className="py-2 pr-3">Student</th>
                  <th className="py-2 pr-3">Class</th>
                  <th className="py-2 pr-3 text-right">Outstanding</th>
                  <th className="py-2 pr-3">Portal Account</th>
                </tr>
              </thead>
              <tbody>
                {recipients.map((r) => (
                  <tr key={r.studentId} className="border-b border-gray-50 dark:border-gray-800">
                    <td className="py-2 pr-3">
                      <p className="font-medium text-gray-900 dark:text-white">{r.fullName}</p>
                      <p className="text-xs font-mono text-gray-500 dark:text-gray-400">{r.studentId}</p>
                    </td>
                    <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">{r.className}</td>
                    <td className="py-2 pr-3 text-right font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(r.totalOutstanding)}
                    </td>
                    <td className="py-2 pr-3">
                      {r.hasPortalAccount ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300">
                          Available
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300">
                          Not available
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {recipients.length > 0 ? (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <ExclamationTriangleIcon className="h-4 w-4 text-amber-500" />
              Students without a portal account are skipped (no operational delivery channel).
            </p>
            {!confirming ? (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                disabled={!messageTemplate.trim() || recipients.length === 0}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <MegaphoneIcon className="h-4 w-4" />
                Send to {recipients.length} students
              </button>
            ) : (
              <div className="flex items-center gap-2">
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
                  {sending ? 'Sending...' : `Confirm & Send to ${recipients.length}`}
                </button>
              </div>
            )}
          </div>
        ) : null}

        {result ? (
          <div className="mt-4 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <p className="text-sm font-semibold text-gray-800 dark:text-white mb-1">Last send result</p>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Sent: <strong>{result.sent}</strong> · Skipped: <strong>{result.skipped}</strong> · Failed:{' '}
              <strong>{result.failed}</strong>
            </p>
          </div>
        ) : null}
      </CardSection>
    </div>
  );
};

export default FeeReminders;
