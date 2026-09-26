import Modal from '../Modal/Modal';
import Button from '../Button/Button';

const ConfirmationModal = ({ isOpen, onClose, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm, variant = 'primary', children, maxWidth, loading }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth={maxWidth || 'max-w-sm'}>
      {children || (
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
          {message}
        </p>
      )}
      <div className="flex gap-3">
        <Button variant="secondary" onClick={onClose} disabled={loading}>{cancelLabel}</Button>
        <Button variant={variant} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
};

export default ConfirmationModal;
