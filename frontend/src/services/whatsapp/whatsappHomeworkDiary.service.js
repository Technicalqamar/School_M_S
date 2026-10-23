import api from '../../api/axios';

// The shared Axios instance has a 20s timeout. A temporary image upload and a
// send that contacts up to 100 guardians can legitimately take longer, so both
// requests get a scoped timeout instead of being reported as a fake failure.
const IMAGE_UPLOAD_TIMEOUT_MS = 2 * 60 * 1000;
const SEND_TIMEOUT_MS = 10 * 60 * 1000;

const whatsappHomeworkDiaryService = {
  getRecipients: async (params = {}) => {
    const query = { ...params };
    if (Array.isArray(query.classNames)) query.classNames = query.classNames.join(',');
    const response = await api.get('/whatsapp/homework-diary/recipients', { params: query });
    return (
      response.data?.data || {
        recipients: [],
        eligibleCount: 0,
        academicYear: null,
        classNames: [],
        maxRecipients: 100,
      }
    );
  },

  // Uploads the selected image to the backend's short-lived in-memory store.
  // The explicit multipart Content-Type is required because the shared Axios
  // instance defaults to application/json; without it Axios would serialize the
  // FormData as JSON instead of sending the file.
  uploadImage: async (file) => {
    const formData = new FormData();
    formData.append('image', file);
    const response = await api.post('/whatsapp/homework-diary/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: IMAGE_UPLOAD_TIMEOUT_MS,
    });
    return response.data?.data || {};
  },

  sendHomeworkDiary: async ({
    studentIds,
    classNames,
    academicYear,
    title,
    message,
    imageId,
  }) => {
    const response = await api.post(
      '/whatsapp/homework-diary/send',
      {
        studentIds,
        classNames,
        academicYear,
        title,
        message,
        imageId,
      },
      { timeout: SEND_TIMEOUT_MS },
    );
    return (
      response.data?.data || {
        recipientCount: 0,
        sent: 0,
        skipped: 0,
        failed: 0,
        results: [],
      }
    );
  },
};

export default whatsappHomeworkDiaryService;
