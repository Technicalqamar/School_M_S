import { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import { CameraIcon } from '@heroicons/react/24/outline';
import CardSection from '../../common/CardSection/CardSection';
import Input from '../../common/Input/Input';
import Spinner from '../../common/Spinner/Spinner';
import schoolSettingsService from '../../../services/schoolSettings/schoolSettings.service';

const IMAGE_FIELDS = [
  { key: 'schoolLogo', label: 'School Logo', apiField: 'schoolLogo' },
  { key: 'adminPanelLogo', label: 'Admin Panel Logo', apiField: 'adminPanelLogo' },
  { key: 'smallLogo', label: 'Small Logo', apiField: 'smallLogo' },
  { key: 'principalSignature', label: 'Principal Signature', apiField: 'principalSignature' },
  { key: 'schoolStamp', label: 'School Stamp', apiField: 'schoolStamp' },
];

const BrandingDocuments = ({ data, onSave, saving }) => {
  const [form, setForm] = useState(() => ({ ...data }));
  const [editing, setEditing] = useState(false);
  const [tempFiles, setTempFiles] = useState({});
  const [uploading, setUploading] = useState(false);
  const [uploadingField, setUploadingField] = useState(null);
  const fileInputs = useRef({});
  const objectUrls = useRef({});

  useEffect(() => {
    return () => {
      Object.values(objectUrls.current).forEach((url) => {
        if (url && url.startsWith('blob:')) URL.revokeObjectURL(url);
      });
    };
  }, []);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleImageChange = (apiField) => (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (objectUrls.current[apiField]) {
      URL.revokeObjectURL(objectUrls.current[apiField]);
    }

    const previewUrl = URL.createObjectURL(file);
    objectUrls.current[apiField] = previewUrl;

    setForm((prev) => ({ ...prev, [apiField]: previewUrl }));
    setTempFiles((prev) => ({ ...prev, [apiField]: file }));

    if (fileInputs.current[apiField]) {
      fileInputs.current[apiField].value = '';
    }
  };

  const handleEdit = () => {
    setForm({ ...data });
    setTempFiles({});
    Object.values(objectUrls.current).forEach((url) => {
      if (url && url.startsWith('blob:')) URL.revokeObjectURL(url);
    });
    objectUrls.current = {};
    setEditing(true);
  };

  const handleSave = async () => {
    setUploading(true);
    try {
      const pending = Object.entries(tempFiles);
      let updatedForm = { ...form };

      for (const [apiField, file] of pending) {
        setUploadingField(apiField);
        try {
          const res = await schoolSettingsService.uploadSchoolImage(apiField, file);
          const imageData = res?.data?.settings?.[apiField];
          const uploadedUrl = imageData?.secure_url || imageData;
          if (uploadedUrl) {
            updatedForm = { ...updatedForm, [apiField]: uploadedUrl };
          }
        } catch {
          const label = IMAGE_FIELDS.find((f) => f.apiField === apiField)?.label || apiField;
          toast.error(`Failed to upload ${label}`);
          throw new Error('Image upload aborted');
        }
      }

      setTempFiles({});
      setForm(updatedForm);
      await onSave(updatedForm);
      setEditing(false);
    } catch {
      // Error toast already shown
    } finally {
      setUploading(false);
      setUploadingField(null);
    }
  };

  return (
    <div className="space-y-6">
      <CardSection title="Images & Signatures">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {IMAGE_FIELDS.map(({ key, label, apiField }) => {
            const isUploading = uploadingField === apiField;
            return (
              <div key={key} className="flex flex-col items-center gap-2">
                <div className="relative group">
                  <div className={`w-28 h-28 rounded-xl border-2 border-dashed bg-gray-50 dark:bg-gray-700 flex items-center justify-center overflow-hidden ${
                    editing ? 'border-gray-300 dark:border-gray-600' : 'border-gray-200 dark:border-gray-700'
                  }`}>
                    {form[key] ? (
                      <img src={form[key]} alt={label} className="w-full h-full object-contain" />
                    ) : (
                      <div className="flex flex-col items-center text-gray-400">
                        <CameraIcon className="h-8 w-8 mb-1" />
                        <span className="text-[10px]">{label}</span>
                      </div>
                    )}
                  </div>
                  {isUploading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-xl">
                      <Spinner size="xs" className="text-white" />
                    </div>
                  ) : editing ? (
                    <label className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-xl opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                      <CameraIcon className="h-6 w-6 text-white" />
                      <input
                        ref={(el) => { fileInputs.current[apiField] = el; }}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageChange(apiField)}
                      />
                    </label>
                  ) : null}
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
              </div>
            );
          })}
        </div>
      </CardSection>

      <CardSection title="Document Headers & Footers">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
          <Input label="PDF Header" name="pdfHeader" value={form.pdfHeader} onChange={handleChange('pdfHeader')} placeholder="PDF document header" disabled={!editing} />
          <Input label="PDF Footer" name="pdfFooter" value={form.pdfFooter} onChange={handleChange('pdfFooter')} placeholder="PDF document footer" disabled={!editing} />
          <Input label="Report Card Header" name="reportCardHeader" value={form.reportCardHeader} onChange={handleChange('reportCardHeader')} placeholder="e.g. Annual Report Card" disabled={!editing} />
          <Input label="Certificate Header" name="certificateHeader" value={form.certificateHeader} onChange={handleChange('certificateHeader')} placeholder="e.g. Certificate of Achievement" disabled={!editing} />
          <Input label="ID Card Header" name="idCardHeader" value={form.idCardHeader} onChange={handleChange('idCardHeader')} placeholder="e.g. Student ID Card" disabled={!editing} />
          <Input label="ID Card Footer" name="idCardFooter" value={form.idCardFooter} onChange={handleChange('idCardFooter')} placeholder="Footer text on ID cards" disabled={!editing} />
          <Input label="Receipt Header" name="receiptHeader" value={form.receiptHeader} onChange={handleChange('receiptHeader')} placeholder="e.g. Fee Receipt" disabled={!editing} />
          <Input label="Receipt Footer" name="receiptFooter" value={form.receiptFooter} onChange={handleChange('receiptFooter')} placeholder="Footer text on receipts" disabled={!editing} />
        </div>
      </CardSection>

      <CardSection title="Footer & Preview">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Footer Text
            </label>
            <textarea
              name="footerText"
              value={form.footerText}
              onChange={handleChange('footerText')}
              placeholder="Default footer text for all documents"
              rows={3}
              disabled={!editing}
              className={`appearance-none block w-full px-4 py-2.5 border rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all bg-white dark:bg-gray-800 dark:text-white dark:border-gray-600 ${
                !editing ? 'text-gray-500 dark:text-gray-400 cursor-not-allowed border-gray-200 dark:border-gray-700' : 'border-gray-300'
              }`}
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Preview
            </label>
            <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 min-h-[80px] flex flex-col items-center justify-center text-center">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-[8px]">
                  L
                </div>
                <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-300">Preview</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 italic">{form.footerText || 'Footer text'}</p>
            </div>
          </div>
        </div>
      </CardSection>

      <div className="flex items-center gap-3">
        {editing ? (
          <button
            onClick={handleSave}
            disabled={uploading || saving}
            className="px-6 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-sm hover:shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? 'Uploading images...' : saving ? 'Saving...' : 'Save Information'}
          </button>
        ) : (
          <button
            onClick={handleEdit}
            className="px-6 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-sm hover:shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Edit Information
          </button>
        )}
      </div>
    </div>
  );
};

export default BrandingDocuments;
