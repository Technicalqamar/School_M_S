import Student from '../../models/student.model.js';
import {
  normalizePakistaniPhone,
  buildGuardianPhoneRegex,
  toStudentSummary,
} from './whatsappGuardian.core.js';

// ---------------------------------------------------------------------------
// Guardian lookup (Phase 3B).
//
// The only relationship that grants access is "this sender number is one of
// the guardian numbers stored on an ACTIVE student record". The Mongo query is
// intentionally permissive about formatting, then every returned record is
// re-normalized in JavaScript and compared to the same canonical number, so a
// query false-positive can never become a guardian match.
//
// Only the minimal fields needed for the child menu are selected; phone
// numbers are never returned to the caller.
// ---------------------------------------------------------------------------

const STUDENT_FIELDS = '_id studentId fullName class fatherPhone alternatePhone whatsappNumber';

const createGuardianService = ({ model = Student } = {}) => {
  if (!model || typeof model.find !== 'function') {
    throw new Error('WhatsApp guardian service requires a Student model');
  }

  const findMatches = async (phone) => {
    const canonicalPhone = normalizePakistaniPhone(phone);
    if (!canonicalPhone) return { canonicalPhone: '', students: [] };

    const pattern = buildGuardianPhoneRegex(canonicalPhone);
    if (!pattern) return { canonicalPhone: '', students: [] };

    const documents = await model
      .find({
        status: 'Active',
        $or: [
          { fatherPhone: pattern },
          { alternatePhone: pattern },
          { whatsappNumber: pattern },
        ],
      })
      .select(STUDENT_FIELDS)
      .lean();

    const seen = new Set();
    const students = [];

    for (const document of Array.isArray(documents) ? documents : []) {
      const fatherPhone = normalizePakistaniPhone(document?.fatherPhone);
      const alternatePhone = normalizePakistaniPhone(document?.alternatePhone);
      const whatsappNumber = normalizePakistaniPhone(document?.whatsappNumber);

      if (
        fatherPhone !== canonicalPhone &&
        alternatePhone !== canonicalPhone &&
        whatsappNumber !== canonicalPhone
      ) {
        continue;
      }

      const summary = toStudentSummary(document);
      if (!summary.id || seen.has(summary.id)) continue;

      seen.add(summary.id);
      students.push(summary);
    }

    // Stable ordering keeps the numbered child list deterministic.
    students.sort(
      (a, b) =>
        a.fullName.localeCompare(b.fullName) ||
        String(a.studentId).localeCompare(String(b.studentId)),
    );

    return { canonicalPhone, students };
  };

  return { findMatches };
};

const whatsappGuardianService = createGuardianService({ model: Student });

export { STUDENT_FIELDS, createGuardianService };
export default whatsappGuardianService;
