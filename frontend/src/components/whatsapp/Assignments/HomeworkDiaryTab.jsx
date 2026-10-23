import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AcademicCapIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PaperAirplaneIcon,
  PhotoIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import CardSection from '../../common/CardSection/CardSection';
import SelectInput from '../../common/SelectInput/SelectInput';
import Input from '../../common/Input/Input';
import Alert from '../../common/Alert/Alert';
import Spinner from '../../common/Spinner/Spinner';
import ClassSelector from '../../communication/ClassSelector';
import { useSchoolConfig } from '../../../contexts/SchoolConfigContext';
import { useAcademicYear } from '../../../utils/academicYear';
import { formatWhatsAppNumber } from '../../../utils/whatsappFeeReminders';
import whatsappHomeworkDiaryService from '../../../services/whatsapp/whatsappHomeworkDiary.service';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_SIZE_MB = MAX_IMAGE_SIZE_BYTES / (1024 * 1024);

const RESULT_META = {
  sent: {
    label: 'Sent (provider accepted)',
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
};

const formatBytes = (bytes) => {
  if (!bytes) return '0 KB';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(2)} MB`;
  const kb = bytes / 1024;
  return `${kb.toFixed(1)} KB`;
};

const HomeworkDiaryTab = () => {
  const { academic } = useSchoolConfig();
  const { year, setYear, options: yearOptions } = useAcademicYear(academic?.currentYear);

  const [selectedClasses, setSelectedClasses] = useState([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [imageError, setImageError] = useState('');

  const [recipients, setRecipients] = useState([]);
  const [maxRecipients, setMaxRecipients] = useState(100);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [reviewing, setReviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [result, setResult] = useState(null);

  const fileInputRef = useRef(null);
  const previewUrlRef = useRef('');
  const sendingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = '';
      }
    };
  }, []);

  const setPreview = useCallback((url) => {
    if (previewUrlRef.current && previewUrlRef.current !== url) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    previewUrlRef.current = url || '';
    setImagePreviewUrl(url || '');
  }, []);

  const handleImageSelect = useCallback(
    (event) => {
      setImageError('');
      const file = event.target.files?.[0];
      if (!file) return;

      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        setImageError('Only JPG, PNG, or WebP images are allowed.');
        event.target.value = '';
        return;
      }
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        setImageError(`Image must be smaller than ${MAX_IMAGE_SIZE_MB} MB. Selected: ${formatBytes(file.size)}.`);
        event.target.value = '';
        return;
      }

      setImageFile(file);
      const url = URL.createObjectURL(file);
      setPreview(url);
      event.target.value = '';
    },
    [setPreview],
  );

  const handleRemoveImage = useCallback(() => {
    setImageFile(null);
    setImageError('');
    setPreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [setPreview]);

  const fetchRecipients = useCallback(async () => {
    if (selectedClasses.length === 0) {
      setRecipients([]);
      setLoadError('');
      return;
    }
    setLoading(true);
    setLoadError('');
    try {
      const data = await whatsappHomeworkDiaryService.getRecipients({
        classNames: selectedClasses,
        academicYear: year,
      });
      setRecipients(Array.isArray(data?.recipients) ? data.recipients : []);
      setMaxRecipients(Number(data?.maxRecipients) > 0 ? Number(data.maxRecipients) : 100);
    } catch (error) {
      setLoadError(
        error?.response?.data?.message || 'Failed to load eligible recipients for the selected class.',
      );
      setRecipients([]);
    } finally {
      setLoading(false);
    }
  }, [selectedClasses, year]);

  useEffect(() => {
    // The async loader owns its loading state; this mirrors the existing
    // WhatsApp settings tab and keeps the effect free of synchronous setState.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRecipients();
  }, [fetchRecipients]);

  const resetReview = useCallback(() => {
    setReviewing(false);
    setSendError('');
    setResult(null);
  }, []);

  const handleClassesChange = useCallback(
    (next) => {
      setSelectedClasses(Array.isArray(next) ? next : []);
      resetReview();
    },
    [resetReview],
  );

  const handleYearChange = useCallback(
    (event) => {
      setYear(event.target.value);
      resetReview();
    },
    [resetReview, setYear],
  );

  const eligibleRecipients = useMemo(() => recipients.filter((r) => r.eligible), [recipients]);
  const eligibleCount = eligibleRecipients.length;

  const captionPreview = useMemo(() => {
    const cleanTitle = title.trim();
    const cleanMessage = message.trim();
    if (!cleanTitle) return '';
    return cleanMessage ? `${cleanTitle}\n\n${cleanMessage}` : cleanTitle;
  }, [title, message]);

  const sendBlockReason = useMemo(() => {
    if (selectedClasses.length === 0) return 'Select at least one class.';
    if (loading) return 'Loading eligible recipients for the selected class(es).';
    if (loadError) return 'Fix the recipient loading error before sending.';
    if (!title.trim()) return 'Enter a homework title.';
    if (!imageFile) return 'Select a homework image.';
    if (eligibleCount === 0) return 'There are no eligible recipients in the selected class(es).';
    if (eligibleCount > maxRecipients) {
      return `This selection has ${eligibleCount} eligible recipients; the maximum per send is ${maxRecipients}. Select fewer classes.`;
    }
    return '';
  }, [eligibleCount, imageFile, loadError, loading, maxRecipients, selectedClasses.length, title]);

  const canSend = !sending && !sendBlockReason;

  const resultRows = useMemo(
    () =>
      (result?.results || []).map((row) => ({
        ...row,
        ...(result?.recipientsSnapshot?.[row.studentId] || {}),
      })),
    [result],
  );

  const handleReview = () => {
    if (!canSend) {
      toast.error(sendBlockReason || 'The homework diary is not ready to send.');
      return;
    }
    setSendError('');
    setResult(null);
    setReviewing(true);
  };

  const handleConfirmSend = async () => {
    if (sendingRef.current) return;
    if (!canSend) {
      toast.error(sendBlockReason || 'The homework diary is not ready to send.');
      return;
    }

    const studentIds = eligibleRecipients.map((recipient) => recipient.studentId);
    const recipientsSnapshot = Object.fromEntries(
      eligibleRecipients.map((recipient) => [
        recipient.studentId,
        {
          fullName: recipient.fullName,
          className: recipient.className,
          whatsappNumber: recipient.whatsappNumber,
        },
      ]),
    );

    sendingRef.current = true;
    setSending(true);
    setSendError('');

    try {
      const uploaded = await whatsappHomeworkDiaryService.uploadImage(imageFile);
      if (!uploaded?.imageId) {
        throw new Error('The image could not be uploaded. Please try again.');
      }

      const data = await whatsappHomeworkDiaryService.sendHomeworkDiary({
        studentIds,
        classNames: selectedClasses,
        academicYear: year,
        title: title.trim(),
        message: message.trim(),
        imageId: uploaded.imageId,
      });

      setResult({ ...data, recipientsSnapshot });
      setReviewing(false);

      // Clear the content that could cause an accidental duplicate send. The
      // class/year stay selected so the admin keeps the context of the result.
      handleRemoveImage();
      setTitle('');
      setMessage('');

      toast.success(
        `WhatsApp homework diary processed - sent: ${data.sent}, skipped: ${data.skipped}, failed: ${data.failed}`,
      );
      if (Number(data.failed) > 0) {
        toast.error('Some homework diary messages could not be sent. Review the results below.');
      }
    } catch (error) {
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        'Failed to send the WhatsApp homework diary. Please try again.';
      setSendError(errorMessage);
      setResult(null);
      setReviewing(false);
      toast.error(errorMessage);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <CardSection title="Homework Diary Details">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SelectInput
            label="Academic Year"
            name="homeworkDiaryAcademicYear"
            value={year}
            onChange={handleYearChange}
            options={yearOptions}
            placeholder="Select year"
          />
        </div>

        <div className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              Class{' '}
              <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                ({selectedClasses.length ? `${selectedClasses.length} selected` : 'select a class'})
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
          <ClassSelector value={selectedClasses} onChange={handleClassesChange} />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4">
          <Input
            label="Homework Title"
            name="homeworkTitle"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Math Exercise 5"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              Optional Message for Parents
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Add any additional instructions..."
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>
      </CardSection>

      <CardSection title="Homework Image">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Allowed: JPG, PNG, WebP. Max size: {MAX_IMAGE_SIZE_MB} MB. The image is uploaded only when
          you confirm the send, kept temporarily on this backend, and never stored permanently in
          MongoDB or Cloudinary.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleImageSelect}
            className="hidden"
            aria-label="Select homework image"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
          >
            <PhotoIcon className="h-4 w-4" />
            {imageFile ? 'Change image' : 'Select image'}
          </button>
          {imageFile ? (
            <button
              type="button"
              onClick={handleRemoveImage}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
            >
              <XMarkIcon className="h-4 w-4" />
              Remove image
            </button>
          ) : null}
        </div>

        {imageFile ? (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            {imageFile.name} • {formatBytes(imageFile.size)}
          </p>
        ) : null}

        {imageError ? <div className="mt-3"><Alert type="error" message={imageError} /></div> : null}

        {imagePreviewUrl ? (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
              Local Preview
            </p>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-2 bg-gray-50 dark:bg-gray-900/40">
              <img
                src={imagePreviewUrl}
                alt="Homework diary preview"
                className="max-h-80 max-w-full w-auto rounded-md object-contain"
              />
            </div>
          </div>
        ) : null}
      </CardSection>

      <CardSection title="Eligible Recipients (Preview)">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Only active students in the selected class and academic year with a valid dedicated{' '}
          <span className="font-medium">whatsappNumber</span> are eligible.{' '}
          <span className="font-medium">fatherPhone</span> and{' '}
          <span className="font-medium">alternatePhone</span> are not used.
        </p>

        {selectedClasses.length === 0 ? (
          <div className="flex items-center gap-2 justify-center py-6 text-sm text-gray-500 dark:text-gray-400">
            <AcademicCapIcon className="h-5 w-5" />
            Select at least one class to load eligible recipients.
          </div>
        ) : loading ? (
          <div className="flex justify-center py-8">
            <Spinner size="md" className="text-blue-600" />
          </div>
        ) : loadError ? (
          <Alert type="error" message={loadError} />
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-700 dark:text-gray-200">
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">{eligibleCount}</span>{' '}
                eligible recipient{eligibleCount === 1 ? '' : 's'} in {year}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Showing {recipients.length} student{recipients.length === 1 ? '' : 's'} in selected class(es)
              </p>
            </div>
            {recipients.length === 0 ? (
              <div className="flex items-center gap-2 justify-center py-6 text-sm text-gray-500 dark:text-gray-400">
                <CheckCircleIcon className="h-5 w-5 text-emerald-500" />
                No students found for the selected class(es) and academic year.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                      <th className="py-2 pr-3">Student</th>
                      <th className="py-2 pr-3">Class</th>
                      <th className="py-2 pr-3">Guardian WhatsApp</th>
                      <th className="py-2 pr-3">Eligibility</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipients.map((recipient) => (
                      <tr key={recipient.studentId} className="border-b border-gray-50 dark:border-gray-800">
                        <td className="py-2 pr-3">
                          <p className="font-medium text-gray-900 dark:text-white">{recipient.fullName}</p>
                          <p className="text-xs font-mono text-gray-500 dark:text-gray-400">{recipient.studentId}</p>
                        </td>
                        <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">{recipient.className}</td>
                        <td className="py-2 pr-3">
                          <span className={recipient.eligible ? 'text-gray-700 dark:text-gray-200' : 'text-amber-600 dark:text-amber-400'}>
                            {recipient.eligible ? formatWhatsAppNumber(recipient.whatsappNumber) : 'Not provided / invalid'}
                          </span>
                        </td>
                        <td className="py-2 pr-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              recipient.eligible
                                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                                : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                            }`}
                          >
                            {recipient.eligible ? 'Eligible' : 'Missing WhatsApp'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </CardSection>

      <CardSection title="Review">
        <div className="space-y-2 text-sm text-gray-700 dark:text-gray-200">
          <p>
            <span className="font-medium">Academic Year:</span> {year || '—'}
          </p>
          <p>
            <span className="font-medium">Class:</span>{' '}
            {selectedClasses.length ? selectedClasses.join(', ') : '—'}
          </p>
          <p>
            <span className="font-medium">Homework Title:</span> {title.trim() || '—'}
          </p>
          <p>
            <span className="font-medium">Message:</span> {message.trim() || '—'}
          </p>
          <p>
            <span className="font-medium">Image:</span> {imageFile ? imageFile.name : '—'}
          </p>
          <p>
            <span className="font-medium">Eligible Recipients:</span> {eligibleCount}
          </p>
        </div>
        {imagePreviewUrl ? (
          <div className="mt-3">
            <img src={imagePreviewUrl} alt="Review preview" className="max-h-40 max-w-full w-auto rounded-md border border-gray-200 dark:border-gray-700" />
          </div>
        ) : null}
      </CardSection>

      <CardSection title="Send">
        <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3 mb-4">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
            <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0" />
            Sending may contact real guardians on WhatsApp.
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
            The image and caption will be sent to {eligibleCount} eligible recipient
            {eligibleCount === 1 ? '' : 's'}. A successful send means the WhatsApp provider accepted
            the request; it is not proof of delivery or reading.
          </p>
        </div>

        {sendError ? <Alert type="error" message={sendError} /> : null}

        <button
          type="button"
          onClick={handleReview}
          disabled={!canSend}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <PaperAirplaneIcon className="h-4 w-4" />
          {sending ? 'Sending...' : `Review and send${eligibleCount ? ` to ${eligibleCount}` : ''}`}
        </button>

        {!canSend && sendBlockReason ? (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">{sendBlockReason}</p>
        ) : null}
      </CardSection>

      {reviewing ? (
        <CardSection title="Confirm WhatsApp Homework Diary">
          <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3 mb-4">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
              <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0" />
              You are about to contact {eligibleCount} real guardian
              {eligibleCount === 1 ? '' : 's'} on WhatsApp.
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
              &quot;Sent&quot; means the WhatsApp provider accepted the message. It is not proof that
              the message was delivered or read.
            </p>
          </div>

          {sendError ? <Alert type="error" message={sendError} /> : null}

          <div className="space-y-2 mb-4">
            {eligibleRecipients.map((recipient) => (
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
                </div>
              </div>
            ))}
          </div>

          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
              WhatsApp Caption
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{captionPreview}</p>
          </div>

          {imagePreviewUrl ? (
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                Image
              </p>
              <img
                src={imagePreviewUrl}
                alt="Homework diary confirmation preview"
                className="max-h-52 max-w-full w-auto rounded-md border border-gray-200 dark:border-gray-700"
              />
            </div>
          ) : null}

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
              onClick={handleConfirmSend}
              disabled={!canSend}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <PaperAirplaneIcon className="h-4 w-4" />
              {sending ? 'Sending...' : `Confirm and send to ${eligibleCount}`}
            </button>
          </div>
          {sending ? (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-right">
              Please wait. The image upload and provider calls are in progress and cannot be submitted
              twice.
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
              const meta = RESULT_META[row.status] || RESULT_META.failed;
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

export default HomeworkDiaryTab;
