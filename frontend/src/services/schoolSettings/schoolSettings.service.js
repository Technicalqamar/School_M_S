import api from '../../api/axios';

const schoolSettingsService = {
  getPublicSchoolSettings: async () => {
    const response = await api.get('/school-settings/public');
    return response.data;
  },

  getSchoolSettings: async () => {
    const response = await api.get('/school-settings');
    return response.data;
  },

  updateSchoolInformation: async (data) => {
    const response = await api.put('/school-settings/information', data);
    return response.data;
  },

  updateAcademicSettings: async (data) => {
    const response = await api.put('/school-settings/academic', data);
    return response.data;
  },

  updateBrandingSettings: async (data) => {
    const response = await api.put('/school-settings/branding', data);
    return response.data;
  },

  updateSystemPreferences: async (data) => {
    const response = await api.put('/school-settings/preferences', data);
    return response.data;
  },

  uploadSchoolImage: async (field, file) => {
    const formData = new FormData();
    formData.append('image', file);
    const response = await api.put(`/school-settings/image/${field}`, formData);
    return response.data;
  },
};

export default schoolSettingsService;
