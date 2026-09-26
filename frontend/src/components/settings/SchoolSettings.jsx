import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import GeneralInformation from './tabs/GeneralInformation';
import AcademicConfiguration from './tabs/AcademicConfiguration';
import BrandingDocuments from './tabs/BrandingDocuments';
import Localization from './tabs/Localization';
import SystemPreferences from './tabs/SystemPreferences';
import LoginSplashScreen from './tabs/LoginSplashScreen';
import schoolSettingsService from '../../services/schoolSettings/schoolSettings.service';
import { useSchoolConfig } from '../../contexts/SchoolConfigContext';
import Spinner from '../common/Spinner/Spinner';

const TABS = [
  { id: 'general', label: 'General Information' },
  { id: 'academic', label: 'Attendance Settings' },
  { id: 'branding', label: 'Branding & Documents' },
  { id: 'localization', label: 'Localization' },
  { id: 'preferences', label: 'System Preferences' },
  { id: 'login', label: 'Login & Splash Screen' },
];

const DEFAULT_GENERAL = {
  schoolName: '',
  shortName: '',
  registrationNumber: '',
  principalName: '',
  schoolEmail: '',
  contactNumber: '',
  whatsappNumber: '',
  website: '',
  completeAddress: '',
  city: '',
  province: '',
  country: '',
  googleMapLocation: '',
};

const DEFAULT_ACADEMIC = {
  currentAcademicYear: '',
  schoolShift: '',
  weeklyHolidays: [],
  schoolStartTime: '',
  schoolEndTime: '',
  attendanceStartTime: '',
  attendanceClosingTime: '',
  weekendEnabled: true,
  weekendDays: ['Saturday', 'Sunday'],
  allowEditAfterSubmit: false,
  editTimeLimit: 1,
  autoMarkAbsent: false,
  lateAllowed: false,
  lateGracePeriod: 5,
  allowLeaveMarking: true,
  allowHalfDayLeave: false,
};

const DEFAULT_BRANDING = {
  schoolLogo: null,
  adminPanelLogo: null,
  smallLogo: null,
  principalSignature: null,
  schoolStamp: null,
  footerText: '',
  pdfHeader: '',
  pdfFooter: '',
  reportCardHeader: '',
  certificateHeader: '',
  idCardHeader: '',
  idCardFooter: '',
  receiptHeader: '',
  receiptFooter: '',
};

const DEFAULT_LOCALIZATION = {
  currency: '',
  currencySymbol: '',
  defaultLanguage: '',
  timeFormat: '',
};

const DEFAULT_PREFERENCES = {
  defaultTheme: '',
  primaryColor: '#2563eb',
  secondaryColor: '#1e40af',
  autoLogout: true,
  defaultLandingPage: '',
  enableNotifications: true,
  enableEmailNotifications: true,
  enableSmsNotifications: false,
  enableWhatsAppNotifications: false,
  allowPublicWebsite: false,
  enableParentPortal: false,
  enableTeacherPortal: false,
};

const DEFAULT_LOGIN = {
  showSchoolLogoOnLogin: true,
  showSchoolNameOnLogin: true,
  loginTheme: '',
  splashEnabled: true,
  loaderStyle: '',
};

const mapApiToGeneral = (api) => ({
  schoolName: api.schoolName || '',
  shortName: api.shortName || '',
  registrationNumber: api.registrationNumber || '',
  principalName: api.principalName || '',
  schoolEmail: api.schoolEmail || '',
  contactNumber: api.contactNumber || '',
  whatsappNumber: api.whatsappNumber || '',
  website: api.website || '',
  completeAddress: api.address || '',
  city: api.city || '',
  province: api.province || '',
  country: api.country || '',
  googleMapLocation: api.googleMapLocation || '',
});

const mapApiToAcademic = (api) => ({
  currentAcademicYear: api.currentAcademicYear || '',
  schoolShift: api.schoolShift || '',
  weeklyHolidays: api.weekendDays || [],
  schoolStartTime: api.schoolStartTime || '',
  schoolEndTime: api.schoolEndTime || '',
  attendanceStartTime: api.attendanceStartTime || '',
  attendanceClosingTime: api.attendanceClosingTime || '',
  weekendEnabled: api.weekendEnabled ?? true,
  weekendDays: api.weekendDays || ['Saturday', 'Sunday'],
  allowEditAfterSubmit: api.allowEditAfterSubmit ?? false,
  editTimeLimit: api.editTimeLimit ?? 1,
  autoMarkAbsent: api.autoMarkAbsent ?? false,
  lateAllowed: api.lateAllowed ?? false,
  lateGracePeriod: api.lateGracePeriod ?? 5,
  allowLeaveMarking: api.allowLeaveMarking ?? true,
  allowHalfDayLeave: api.allowHalfDayLeave ?? false,
});

const mapApiToBranding = (api) => ({
  schoolLogo: api.schoolLogo?.secure_url || null,
  adminPanelLogo: api.adminPanelLogo?.secure_url || null,
  smallLogo: api.smallLogo?.secure_url || null,
  principalSignature: api.principalSignature?.secure_url || null,
  schoolStamp: api.schoolStamp?.secure_url || null,
  footerText: api.footerText || '',
  pdfHeader: api.pdfHeader || '',
  pdfFooter: api.pdfFooter || '',
  reportCardHeader: api.reportCardHeader || '',
  certificateHeader: api.certificateHeader || '',
  idCardHeader: api.idCardHeader || '',
  idCardFooter: api.idCardFooter || '',
  receiptHeader: api.receiptHeader || '',
  receiptFooter: api.receiptFooter || '',
});

const mapApiToLocalization = (api) => ({
  currency: api.currency || '',
  currencySymbol: api.currencySymbol || '',
  defaultLanguage: api.defaultLanguage || '',
  timeFormat: api.timeFormat || '',
});

const mapApiToPreferences = (api) => ({
  defaultTheme: api.defaultTheme || '',
  primaryColor: api.primaryColor || '#2563eb',
  secondaryColor: api.secondaryColor || '#1e40af',
  autoLogout: api.autoLogout ?? true,
  defaultLandingPage: api.defaultLandingPage || '',
  enableNotifications: api.enableNotifications ?? true,
  enableEmailNotifications: api.enableEmailNotifications ?? true,
  enableSmsNotifications: api.enableSmsNotifications ?? false,
  enableWhatsAppNotifications: api.enableWhatsAppNotifications ?? false,
  allowPublicWebsite: api.allowPublicWebsite ?? false,
  enableParentPortal: api.enableParentPortal ?? false,
  enableTeacherPortal: api.enableTeacherPortal ?? false,
});

const mapApiToLogin = (api) => ({
  showSchoolLogoOnLogin: api.showSchoolLogoOnLogin ?? true,
  showSchoolNameOnLogin: api.showSchoolNameOnLogin ?? true,
  loginTheme: api.loginTheme || '',
  splashEnabled: api.splashEnabled ?? true,
  loaderStyle: api.loaderStyle || '',
});

const SchoolSettings = () => {
  const { refresh } = useSchoolConfig();
  const [activeTab, setActiveTab] = useState(TABS[0].id);
  const [apiSettings, setApiSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await schoolSettingsService.getSchoolSettings();
      setApiSettings(res.data.settings);
    } catch {
      toast.error('Failed to load school settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const generalData = apiSettings ? mapApiToGeneral(apiSettings) : DEFAULT_GENERAL;
  const academicData = apiSettings ? mapApiToAcademic(apiSettings) : DEFAULT_ACADEMIC;
  const brandingData = apiSettings ? mapApiToBranding(apiSettings) : DEFAULT_BRANDING;
  const localizationData = apiSettings ? mapApiToLocalization(apiSettings) : DEFAULT_LOCALIZATION;
  const preferencesData = apiSettings ? mapApiToPreferences(apiSettings) : DEFAULT_PREFERENCES;
  const loginData = apiSettings ? mapApiToLogin(apiSettings) : DEFAULT_LOGIN;

  const handleSaveGeneral = async (formData) => {
    setSaving(true);
    try {
      const payload = {
        schoolName: formData.schoolName,
        shortName: formData.shortName,
        registrationNumber: formData.registrationNumber,
        principalName: formData.principalName,
        schoolEmail: formData.schoolEmail,
        contactNumber: formData.contactNumber,
        whatsappNumber: formData.whatsappNumber,
        website: formData.website,
        address: formData.completeAddress,
        city: formData.city,
        province: formData.province,
        country: formData.country,
        googleMapLocation: formData.googleMapLocation,
      };
      const res = await schoolSettingsService.updateSchoolInformation(payload);
      setApiSettings(res.data.settings);
      toast.success('School information saved successfully');
      refresh();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save school information');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAcademic = async (formData) => {
    setSaving(true);
    try {
      const payload = {
        currentAcademicYear: formData.currentAcademicYear,
        schoolShift: formData.schoolShift,
        schoolStartTime: formData.schoolStartTime,
        schoolEndTime: formData.schoolEndTime,
        attendanceStartTime: formData.attendanceStartTime,
        attendanceClosingTime: formData.attendanceClosingTime,
        weekendEnabled: formData.weekendEnabled,
        weekendDays: formData.weekendDays,
        allowEditAfterSubmit: formData.allowEditAfterSubmit,
        editTimeLimit: formData.editTimeLimit,
        autoMarkAbsent: formData.autoMarkAbsent,
        lateAllowed: formData.lateAllowed,
        lateGracePeriod: formData.lateGracePeriod,
        allowLeaveMarking: formData.allowLeaveMarking,
        allowHalfDayLeave: formData.allowHalfDayLeave,
      };
      const res = await schoolSettingsService.updateAcademicSettings(payload);
      setApiSettings(res.data.settings);
      toast.success('Academic settings saved successfully');
      refresh();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save academic settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBranding = async (formData) => {
    setSaving(true);
    try {
      const payload = {
        pdfHeader: formData.pdfHeader,
        pdfFooter: formData.pdfFooter,
        reportCardHeader: formData.reportCardHeader,
        certificateHeader: formData.certificateHeader,
        idCardHeader: formData.idCardHeader,
        idCardFooter: formData.idCardFooter,
        receiptHeader: formData.receiptHeader,
        receiptFooter: formData.receiptFooter,
        footerText: formData.footerText,
      };
      const res = await schoolSettingsService.updateBrandingSettings(payload);
      setApiSettings(res.data.settings);
      toast.success('Branding settings saved successfully');
      refresh();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save branding settings');
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (field, file) => {
    setUploadingField(field);
    try {
      const res = await schoolSettingsService.uploadSchoolImage(field, file);
      setApiSettings(res.data.settings);
      toast.success('Image uploaded successfully');
      refresh();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to upload image');
    } finally {
      setUploadingField(null);
    }
  };

  const handleSaveLocalization = async (formData) => {
    setSaving(true);
    try {
      const academicPayload = {
        defaultLanguage: formData.defaultLanguage,
        timeFormat: formData.timeFormat,
      };
      const preferencesPayload = {
        currency: formData.currency,
        currencySymbol: formData.currencySymbol,
      };
      const academicRes = await schoolSettingsService.updateAcademicSettings(academicPayload);
      await schoolSettingsService.updateSystemPreferences(preferencesPayload);
      setApiSettings(academicRes.data.settings);
      toast.success('Localization settings saved successfully');
      refresh();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save localization settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePreferences = async (formData) => {
    setSaving(true);
    try {
      const payload = {
        defaultTheme: formData.defaultTheme,
        primaryColor: formData.primaryColor,
        secondaryColor: formData.secondaryColor,
        autoLogout: formData.autoLogout,
        defaultLandingPage: formData.defaultLandingPage,
        enableNotifications: formData.enableNotifications,
        enableEmailNotifications: formData.enableEmailNotifications,
        enableSmsNotifications: formData.enableSmsNotifications,
        enableWhatsAppNotifications: formData.enableWhatsAppNotifications,
        allowPublicWebsite: formData.allowPublicWebsite,
        enableParentPortal: formData.enableParentPortal,
        enableTeacherPortal: formData.enableTeacherPortal,
      };
      const res = await schoolSettingsService.updateSystemPreferences(payload);
      setApiSettings(res.data.settings);
      toast.success('System preferences saved successfully');
      refresh();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save system preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLogin = async (formData) => {
    setSaving(true);
    try {
      const payload = {
        showSchoolLogoOnLogin: formData.showSchoolLogoOnLogin,
        showSchoolNameOnLogin: formData.showSchoolNameOnLogin,
        loginTheme: formData.loginTheme,
        splashEnabled: formData.splashEnabled,
        loaderStyle: formData.loaderStyle,
      };
      const res = await schoolSettingsService.updateSystemPreferences(payload);
      setApiSettings(res.data.settings);
      toast.success('Login & splash settings saved successfully');
      refresh();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save login & splash settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">School Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Configure global school information, academics, branding, localization, system preferences, and login screen</p>
      </div>

      <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="md" className="text-blue-600" />
        </div>
      ) : (
        <>
          {activeTab === 'general' && (
            <GeneralInformation
              data={generalData}
              onSave={handleSaveGeneral}
              saving={saving}
            />
          )}
          {activeTab === 'academic' && (
            <AcademicConfiguration
              data={academicData}
              onSave={handleSaveAcademic}
              saving={saving}
            />
          )}
          {activeTab === 'branding' && (
            <BrandingDocuments
              data={brandingData}
              onSave={handleSaveBranding}
              onImageUpload={handleImageUpload}
              saving={saving}
              uploadingField={uploadingField}
            />
          )}
          {activeTab === 'localization' && (
            <Localization
              data={localizationData}
              onSave={handleSaveLocalization}
              saving={saving}
            />
          )}
          {activeTab === 'preferences' && (
            <SystemPreferences
              data={preferencesData}
              onSave={handleSavePreferences}
              saving={saving}
            />
          )}
          {activeTab === 'login' && (
            <LoginSplashScreen
              data={loginData}
              onSave={handleSaveLogin}
              saving={saving}
            />
          )}
        </>
      )}
    </div>
  );
};

export default SchoolSettings;
