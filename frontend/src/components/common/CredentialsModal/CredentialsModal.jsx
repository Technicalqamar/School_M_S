import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  CheckIcon,
  ClipboardIcon,
  EyeIcon,
  EyeSlashIcon,
  KeyIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import { useTranslation } from '../../../hooks/useLocalization';

// A single credential row with a copy button (and show/hide for the secret).
const CredentialRow = ({ icon: Icon, label, value, secret, t }) => {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(t('copied'));
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('copyFailed'));
    }
  };

  return (
    <div className="mb-4">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">{label}</p>
      <div className="flex items-center gap-2">
        <div className="flex items-center flex-1 min-w-0 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/40 px-3 py-2.5">
          {Icon && <Icon className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />}
          <span className="text-sm font-mono text-gray-900 dark:text-white truncate">
            {secret && !revealed ? '••••••••' : value}
          </span>
          {secret && (
            <button
              type="button"
              onClick={() => setRevealed((s) => !s)}
              className="ml-auto pl-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors cursor-pointer"
              aria-label={revealed ? t('hidePassword') : t('showPassword')}
            >
              {revealed ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
        >
          {copied ? <CheckIcon className="h-4 w-4 text-green-500" /> : <ClipboardIcon className="h-4 w-4" />}
          <span className="hidden sm:inline">{copied ? t('copied') : t('copy')}</span>
        </button>
      </div>
    </div>
  );
};

/**
 * Shows the login ID and initial password of a freshly created Student/Teacher
 * portal account. The plaintext password is only held in component state while
 * the modal is open and is never persisted to storage.
 */
const CredentialsModal = ({ isOpen, onClose, role = 'student', loginId, password }) => {
  const { t } = useTranslation();
  if (!isOpen) return null;

  const roleLabel = role === 'teacher' ? t('roleTeacher') : t('roleStudent');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('credentialsTitle')}>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{t('credentialsSubtitle')}</p>

      <div className="mb-5 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-4 py-3">
        <p className="text-xs text-blue-700 dark:text-blue-300">{t('credentialsPrivateNote')}</p>
      </div>

      <CredentialRow
        icon={UserCircleIcon}
        label={`${roleLabel} ${t('credentialsLoginId')}`}
        value={loginId || ''}
        secret={false}
        t={t}
      />
      <CredentialRow
        icon={KeyIcon}
        label={t('credentialsPassword')}
        value={password || ''}
        secret
        t={t}
      />

      <div className="mt-2">
        <Button variant="primary" onClick={onClose}>{t('credentialsDone')}</Button>
      </div>
    </Modal>
  );
};

export default CredentialsModal;
