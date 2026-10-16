import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  IdentificationIcon,
  PrinterIcon,
  ArrowPathIcon,
  QrCodeIcon,
  CheckBadgeIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import Spinner from '../../common/Spinner/Spinner';
import Button from '../../common/Button/Button';
import { useAuth } from '../../../contexts/AuthContext';
import { useSchoolConfig } from '../../../contexts/SchoolConfigContext';
import { hasReceptionistActionAccess } from '../../../constants/receptionistPermissions';
import qrManagementService from '../../../services/qrManagement/qrManagement.service';
import { VerticalTemplate, HorizontalTemplate } from '../../attendance/templates';
import {
  buildIdCardStudent,
  findStudentCard,
  deriveCardStatus,
} from '../../../utils/singleStudentActions';
import { resolveIdCardDesign } from '../../../utils/idCardDesign';

const STATUS_BADGE = {
  Printed: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  Generated: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  Pending: 'bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300',
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-GB');
};

// The Single Student Management "ID Card" page.
//
// It reuses the project's one ID card generator: the same `VerticalTemplate` /
// `HorizontalTemplate` React components for the on-screen preview and the same
// `Template.toHtml(...)` renderer the Attendance module prints from, so the
// printed card is pixel-for-pixel the design the school already uses. The card
// is fetched for the selected student specifically (by class + studentId) and
// merged with the selected student's own record, so a previous student's card
// can never be shown.
const StudentIdCard = () => {
  const { student } = useOutletContext();
  const { user } = useAuth();
  const { schoolInfo } = useSchoolConfig();

  const canView = hasReceptionistActionAccess(user, 'attendance-management', 'id-card-view');
  const canGenerate = hasReceptionistActionAccess(user, 'attendance-management', 'id-card-generate');

  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [side, setSide] = useState('front');
  // A manual vertical/horizontal toggle overrides the saved orientation for the
  // current student only; `{ studentId }` scopes it so switching students never
  // leaks the previous student's choice.
  const [templateChoice, setTemplateChoice] = useState({ studentId: null, value: null });

  const SCHOOL_INFO = useMemo(() => ({
    name: schoolInfo.name,
    address: schoolInfo.address || schoolInfo.schoolAddress || 'N/A',
    contact: schoolInfo.contact || schoolInfo.schoolContact || 'N/A',
    email: schoolInfo.email || schoolInfo.schoolEmail || 'N/A',
  }), [schoolInfo]);

  useEffect(() => {
    if (!student?._id || !canView) return undefined;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const result = await qrManagementService.getStudentsWithCards({
          academicYear: student.academicYear,
          class: student.class,
          search: student.studentId,
        });
        if (cancelled) return;
        setCard(findStudentCard(result.students, student));
      } catch (err) {
        if (cancelled) return;
        setCard(null);
        setError(err?.response?.data?.message || 'Failed to load the ID card');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [student, canView, reloadKey]);

  // Always built from the selected student first; the fetched card only adds the
  // QR value and status. Never from a different student.
  const cardStudent = useMemo(
    () => buildIdCardStudent(student, card),
    [student, card],
  );

  // The saved design persisted for THIS card, resolved through the exact same
  // rule the bulk designer uses (frontDesign/backDesign presence). Absent,
  // incomplete or invalid designs resolve to the default layout, so the page
  // keeps working for cards that were never designed.
  const savedDesign = useMemo(() => resolveIdCardDesign(card), [card]);

  // Saved orientation is the default; a manual toggle wins for this student.
  const templateOverride =
    templateChoice.studentId === student?._id ? templateChoice.value : null;
  const template = templateOverride || savedDesign.template;

  const cardStatus = deriveCardStatus(card, cardStudent);

  const handleRefresh = useCallback(() => setReloadKey((key) => key + 1), []);

  const handleGenerate = async () => {
    if (!student?._id || busy) return;
    setBusy(true);
    try {
      if (cardStatus === 'Pending') {
        await qrManagementService.generateQRCodes({
          studentIds: [student._id],
          academicYear: student.academicYear,
        });
        toast.success('QR code generated');
      } else {
        await qrManagementService.regenerateQRCode(student._id);
        toast.success('QR code regenerated successfully');
      }
      handleRefresh();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to generate the QR code');
    } finally {
      setBusy(false);
    }
  };

  const handleMarkPrinted = async () => {
    if (!student?._id || busy) return;
    setBusy(true);
    try {
      await qrManagementService.markAsPrinted([student._id]);
      toast.success('Card marked as printed');
      handleRefresh();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to mark the card as printed');
    } finally {
      setBusy(false);
    }
  };

  const handlePrint = async () => {
    const Template = template === 'horizontal' ? HorizontalTemplate : VerticalTemplate;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Popup blocked. Allow pop-ups to print the ID card.');
      return;
    }

    try {
      const cardsHtml = await Template.toHtml(
        cardStudent,
        SCHOOL_INFO,
        savedDesign.frontConfig,
        savedDesign.backConfig,
      );
      const printCss = `
        @page { size: A4; margin: 5mm; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      `;
      printWindow.document.open();
      printWindow.document.write(`<!DOCTYPE html><html><head><title>Print ID Card</title><style>${printCss}</style></head><body>${cardsHtml}</body></html>`);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 500);
    } catch {
      printWindow.close();
      toast.error('Failed to prepare the ID card for printing');
    }
  };

  // The workspace layout only renders this page once the student is resolved,
  // but guard anyway so a direct render cannot touch a null student.
  if (!student) return null;

  if (!canView) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
        <IdentificationIcon className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">ID card access required</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          You do not have permission to view ID cards. Ask an administrator to grant the Attendance
          Management module.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="md" className="text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">ID Card</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            ID card for {student?.fullName} ({student?.studentId}) · {student?.class}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[cardStatus] || STATUS_BADGE.Pending}`}>
            {cardStatus}
          </span>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all cursor-pointer"
          >
            <PrinterIcon className="h-4 w-4" />
            Print
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-2 text-sm text-amber-600 dark:text-amber-500">
          <ArrowPathIcon className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex flex-wrap items-center gap-2 mb-5">
            <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              {['front', 'back'].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSide(value)}
                  className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors cursor-pointer ${
                    side === value
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
            <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              {['vertical', 'horizontal'].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTemplateChoice({ studentId: student?._id, value })}
                  className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors cursor-pointer ${
                    template === value
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-center py-4 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 overflow-x-auto">
            {template === 'horizontal' ? (
              <HorizontalTemplate
                student={cardStudent}
                schoolInfo={SCHOOL_INFO}
                side={side}
                layoutConfig={side === 'back' ? savedDesign.backConfig : savedDesign.frontConfig}
              />
            ) : (
              <VerticalTemplate
                student={cardStudent}
                schoolInfo={SCHOOL_INFO}
                side={side}
                layoutConfig={side === 'back' ? savedDesign.backConfig : savedDesign.frontConfig}
              />
            )}
          </div>

          {savedDesign.hasSavedDesign && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
              Previewing the card design saved by the administrator.
            </p>
          )}

          {!cardStudent.qrValue && (
            <p className="text-xs text-amber-600 dark:text-amber-500 mt-3">
              This student does not have a QR code yet. The card preview shows a placeholder; generate
              the QR code to make it scannable.
            </p>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <QrCodeIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
              Card Details
            </h3>
          </div>

          <div className="text-sm space-y-3">
            <div className="flex justify-between gap-4">
              <span className="text-gray-500 dark:text-gray-400">Card Status</span>
              <span className="font-medium text-gray-900 dark:text-white">{cardStatus}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-500 dark:text-gray-400">QR Value</span>
              <span className="font-mono text-xs break-all text-right text-gray-900 dark:text-white">{cardStudent.qrValue || 'Not generated'}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-500 dark:text-gray-400">Generated</span>
              <span className="text-gray-900 dark:text-white text-right">{formatDateTime(card?.generatedAt)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-500 dark:text-gray-400">Printed</span>
              <span className="text-gray-900 dark:text-white text-right">{formatDateTime(card?.printedAt)}</span>
            </div>
          </div>

          {canGenerate && (
            <div className="space-y-2 pt-1">
              <Button onClick={handleGenerate} loading={busy} className="w-full">
                <span className="inline-flex items-center justify-center gap-2">
                  <QrCodeIcon className="h-4 w-4" />
                  {cardStatus === 'Pending' ? 'Generate QR Code' : 'Regenerate QR Code'}
                </span>
              </Button>
              {cardStudent.qrValue && cardStatus !== 'Printed' && (
                <Button variant="secondary" onClick={handleMarkPrinted} disabled={busy} className="w-full">
                  <span className="inline-flex items-center justify-center gap-2">
                    <CheckBadgeIcon className="h-4 w-4" />
                    Mark as Printed
                  </span>
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentIdCard;
