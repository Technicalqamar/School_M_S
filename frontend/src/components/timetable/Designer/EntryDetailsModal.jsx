import { useState } from 'react';
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import Modal from '../../common/Modal/Modal';
import Button from '../../common/Button/Button';
import ConfirmationModal from '../../common/ConfirmationModal/ConfirmationModal';
import { useFormatTime } from '../../../hooks/useLocalization';

const toDate = (time) => new Date(`1970-01-01T${time}:00`);

const Field = ({ label, children }) => (
  <div className="flex items-start justify-between gap-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
    <span className="text-sm text-gray-500 dark:text-gray-400 flex-shrink-0">{label}</span>
    <span className="text-sm font-semibold text-gray-900 dark:text-white text-right min-w-0">{children}</span>
  </div>
);

// Read-only summary of one SAVED timetable entry, opened from the Designer grid.
// "Edit" reuses the Create Timetable form modal (pre-filled); "Delete" asks for
// confirmation before removing the entry through the real backend.
const EntryDetailsModal = ({ cell, groupLabel, onClose, onEdit, onDelete }) => {
  const formatClock = useFormatTime();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    const ok = await onDelete();
    if (ok) setConfirming(false);
    setDeleting(false);
  };

  return (
    <>
      <Modal isOpen onClose={onClose} title="Timetable Entry" maxWidth="max-w-md">
        <div>
          <Field label="Group">{groupLabel || `Group ${cell.group}`}</Field>
          <Field label="Class">
            {cell.className || '—'}
            {cell.classStatus && (
              <span className="block text-xs font-medium text-gray-400 dark:text-gray-500 mt-0.5">
                {cell.classStatus}
              </span>
            )}
          </Field>
          <Field label="Time Slot">
            {formatClock(toDate(cell.startTime))} – {formatClock(toDate(cell.endTime))}
            {cell.slotLabel && (
              <span className="block text-xs font-medium text-gray-400 dark:text-gray-500 mt-0.5">
                {cell.slotLabel}
              </span>
            )}
          </Field>
          <Field label="Subject">
            {cell.subjectName || '—'}
            {cell.subjectCode && (
              <span className="block text-xs font-medium text-gray-400 dark:text-gray-500 mt-0.5">
                {cell.subjectCode}
              </span>
            )}
          </Field>
          <Field label="Teacher">
            {cell.teacherFullName || '—'}
            {cell.teacherCode && (
              <span className="block text-xs font-medium text-gray-400 dark:text-gray-500 mt-0.5">
                {cell.teacherCode}
              </span>
            )}
          </Field>
        </div>

        <div className="flex gap-3 pt-4">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Close
          </Button>
          <Button variant="secondary" onClick={onEdit} className="flex-1">
            <PencilSquareIcon className="h-4 w-4 mr-1.5" /> Edit
          </Button>
          <Button variant="danger" onClick={() => setConfirming(true)} className="flex-1">
            <TrashIcon className="h-4 w-4 mr-1.5" /> Delete
          </Button>
        </div>
      </Modal>

      <ConfirmationModal
        isOpen={confirming}
        onClose={() => {
          if (!deleting) setConfirming(false);
        }}
        title="Delete Timetable Entry"
        message={`Are you sure you want to delete the ${cell.subjectName || 'subject'} entry for ${
          cell.className || 'this class'
        } (${cell.startTime} – ${cell.endTime})? This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </>
  );
};

export default EntryDetailsModal;