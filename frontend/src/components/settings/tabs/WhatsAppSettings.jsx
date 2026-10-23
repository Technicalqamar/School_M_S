import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  InformationCircleIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/24/outline';
import CardSection from '../../common/CardSection/CardSection';
import Input from '../../common/Input/Input';
import Spinner from '../../common/Spinner/Spinner';
import schoolSettingsService from '../../../services/schoolSettings/schoolSettings.service';

// The connection states rendered by this section. `unknown` means the state
// could not be determined - it is never presented as a connected session.
const STATUS_META = {
  not_configured: {
    label: 'Not configured',
    badge: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    Icon: InformationCircleIcon,
    description: 'No WhatsApp API token has been saved yet. Add the token from the provider dashboard to enable WhatsApp.',
  },
  connected: {
    label: 'Connected',
    badge: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    Icon: CheckCircleIcon,
    description: 'The provider confirmed an active WhatsApp session for the saved token.',
  },
  disconnected: {
    label: 'Disconnected',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    Icon: XCircleIcon,
    description: 'The token is saved but the provider reports no active WhatsApp session.',
  },
  unknown: {
    label: 'Unknown',
    badge: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    Icon: QuestionMarkCircleIcon,
    description:
      'The provider response was not recognised, so the connection state could not be determined. The session is not reported as connected.',
  },
  check_failed: {
    label: 'Connection check failed',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    Icon: ExclamationTriangleIcon,
    description: 'The last connection check could not be completed. The token may be invalid or the provider may be unreachable.',
  },
};

// Shown when a token is stored but the connection was never checked.
const NEVER_CHECKED_DESCRIPTION =
  'The connection has not been checked yet. Run a connection test to find out whether the provider reports an active WhatsApp session.';

const DEFAULT_STATUS = {
  configured: false,
  status: 'not_configured',
  connectedNumber: '',
  tokenHint: '',
  lastCheckedAt: null,
};

const formatCheckedAt = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
};

const WhatsAppSettings = () => {
  const [status, setStatus] = useState(DEFAULT_STATUS);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await schoolSettingsService.getWhatsAppSettings();
      setStatus({ ...DEFAULT_STATUS, ...(res?.data || {}) });
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to load WhatsApp settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // The async loader owns its loading state; keep the effect free of a
    // synchronous setState while still fetching on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchStatus();
  }, [fetchStatus]);

  // Runs a live connection check against the provider. The token itself is
  // never sent from the browser - the backend decrypts the stored token.
  const runConnectionTest = async () => {
    setTesting(true);
    try {
      const res = await schoolSettingsService.testWhatsAppConnection();
      const next = { ...DEFAULT_STATUS, ...(res?.data || {}) };
      setStatus(next);

      if (next.status === 'connected') {
        toast.success('WhatsApp connection verified');
      } else if (next.status === 'disconnected') {
        toast.error('The provider reports that the WhatsApp session is not connected');
      } else if (next.status === 'unknown') {
        toast.error('The provider response was not recognised, so the connection state is unknown');
      } else {
        toast.error('WhatsApp connection check failed');
      }
      return next;
    } catch (err) {
      toast.error(err?.response?.data?.message || 'WhatsApp connection check failed');
      // Re-read the persisted state so the section shows "Connection check failed".
      fetchStatus();
      return null;
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    const value = token.trim();
    if (!value) {
      toast.error('Enter the WhatsApp API token first');
      return;
    }

    setSaving(true);
    try {
      const res = await schoolSettingsService.saveWhatsAppToken(value);
      setStatus({ ...DEFAULT_STATUS, ...(res?.data || {}) });
      // The token is never kept in the browser after it was sent.
      setToken('');
      toast.success('WhatsApp API token saved successfully');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save the WhatsApp API token');
      setSaving(false);
      return;
    }
    setSaving(false);

    // Verify the freshly saved token so the admin sees the real state at once.
    await runConnectionTest();
  };

  const meta = STATUS_META[status.status] || STATUS_META.unknown;
  const StatusIcon = meta.Icon;
  const checkedAt = formatCheckedAt(status.lastCheckedAt);
  // A stored token that was never checked has no established state yet.
  const description =
    status.status === 'unknown' && !checkedAt ? NEVER_CHECKED_DESCRIPTION : meta.description;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="md" className="text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CardSection title="WhatsApp Connection">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${meta.badge}`}>
            <StatusIcon className="h-4 w-4" />
            {meta.label}
          </span>
          {status.configured && status.tokenHint && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Stored token: <code className="font-mono text-gray-700 dark:text-gray-200">{status.tokenHint}</code>
            </span>
          )}
        </div>

        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">{description}</p>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-x-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Connected Phone Number
            </label>
            <p className="text-sm text-gray-800 dark:text-gray-100">
              {status.connectedNumber || 'Not available'}
            </p>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Last Connection Check
            </label>
            <p className="text-sm text-gray-800 dark:text-gray-100">{checkedAt || 'Never checked'}</p>
          </div>
        </div>
      </CardSection>

      <CardSection title="WhatsApp API Token">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Paste the API token from the provider dashboard. The token is encrypted before it is stored and is
          never shown again - only a masked hint is displayed above.
        </p>

        <Input
          label="API Token"
          name="whatsappApiToken"
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder={status.configured ? 'Enter a new token to replace the stored one' : 'Enter the WhatsApp API token'}
          disabled={saving || testing}
        />

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || testing || !token.trim()}
            className="px-6 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-sm hover:shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Token'}
          </button>

          <button
            type="button"
            onClick={runConnectionTest}
            disabled={testing || saving || !status.configured}
            className="px-6 py-2.5 rounded-lg text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 dark:text-blue-300 dark:bg-blue-900/30 dark:border-blue-800 dark:hover:bg-blue-900/50 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
        </div>

        {!status.configured && (
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            Save a token before a connection test can be performed.
          </p>
        )}
      </CardSection>
    </div>
  );
};

export { STATUS_META };
export default WhatsAppSettings;
