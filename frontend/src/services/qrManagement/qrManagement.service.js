import api from '../../api/axios';
import studentService from '../student/student.service';

// Normalizes the backend "students with card data" shape into the shape the
// UI consumes. `cardStatus` is authoritative (Pending | Generated | Printed);
// `qrStatus` is derived for display badges; `id` aliases `_id` for selection.
const normalizeStudent = (s, extra = {}) => ({
  _id: s._id,
  id: s._id,
  studentId: s.studentId,
  fullName: s.fullName,
  studentImage: s.studentImage || '',
  class: s.class,
  academicYear: s.academicYear,
  status: s.status,
  // Enriched from the real Students API (not returned by /id-cards/students)
  fatherName: extra.fatherName ?? s.fatherName ?? '',
  fatherPhone: extra.fatherPhone ?? s.fatherPhone ?? '',
  qrValue: s.card?.qrValue || '',
  qrStatus: s.cardStatus === 'Pending' ? 'Pending' : 'Generated',
  cardStatus: s.cardStatus || 'Pending',
  generatedAt: s.card?.generatedAt || null,
  printedAt: s.card?.printedAt || null,
  card: s.card || null,
});

const emptyStats = { total: 0, generated: 0, printed: 0, pending: 0 };

const qrManagementService = {
  /**
   * Loads real students with their ID card / QR data.
   * Primary source: GET /id-cards/students (Phase 1 API).
   * Enriched with fatherName / fatherPhone from GET /students so the printed
   * card preview contains actual student information.
   */
  async getStudentsWithCards(params = {}) {
    const { academicYear, class: className, status, search } = params;

    const response = await api.get('/id-cards/students', {
      params: {
        academicYear: academicYear || undefined,
        class: className && className !== 'All Classes' ? className : undefined,
        status,
        search,
      },
    });

    const data = response.data?.data || { students: [], stats: {} };
    const students = data.students || [];

    if (!students.length) {
      return {
        students: [],
        stats: data.stats || { ...emptyStats },
        enriched: false,
      };
    }

    // Enrich with fatherName / fatherPhone from the real Students API.
    let extra = {};
    try {
      const detail = await studentService.getAllStudents({
        academicYear: academicYear || undefined,
        class: className && className !== 'All Classes' ? className : undefined,
        limit: 100,
      });
      const map = {};
      (detail?.data?.students || []).forEach((st) => {
        map[st._id] = st;
      });
      extra = map;
    } catch {
      extra = {};
    }

    return {
      students: students.map((s) => normalizeStudent(s, extra[s._id] || {})),
      stats: data.stats || { ...emptyStats },
      enriched: Object.keys(extra).length > 0,
    };
  },

  /**
   * Generates / updates QR values via POST /id-cards/generate.
   * Pass academicYear / class to cover a whole group, or studentIds to target
   * specific students. Idempotent — students that already have a QR are skipped
   * unless regenerate: true is set.
   */
  async generateQRCodes(data = {}) {
    const response = await api.post('/id-cards/generate', data);
    return response.data?.data || response.data;
  },

  /** Regenerates the QR value for a single student. */
  async regenerateQRCode(studentId) {
    const response = await api.post(`/id-cards/regenerate/${studentId}`);
    return response.data?.data || response.data;
  },

  /** Marks the given students' cards as Printed. */
  async markAsPrinted(studentIds) {
    const response = await api.patch('/id-cards/mark-printed', { studentIds });
    return response.data?.data || response.data;
  },

  /**
   * Persists the designer layout for a single student card
   * (PUT /id-cards/:studentId/design -> IdCardManagement.frontDesign/backDesign).
   * The designer edits one layout for the whole working set, so callers fan this
   * out over the students the layout applies to. `data` is built by
   * `buildDesignPayload` ({ template, frontDesign, backDesign }).
   */
  async updateCardDesign(studentId, data = {}) {
    const response = await api.put(`/id-cards/${studentId}/design`, data);
    return response.data?.data || response.data;
  },
};

export default qrManagementService;