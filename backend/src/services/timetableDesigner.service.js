import { ApiError } from '../utils/apiError.js';
import Class from '../models/class.model.js';
import TimeSlot from '../models/timeSlot.model.js';
import SchoolSettings from '../models/schoolSettings.model.js';
import TimetableEntry from '../models/timetableEntry.model.js';

// Timetable Designer — READ-ONLY backend.
//
// Composes the real saved timetable entries (the `timetableentries` collection
// created by the Create Timetable module) into a designer/view grid organized
// by Academic Year → Group → Time Slot → Class.
//
//   - Groups are derived from the class NAME (fixed map below); the class list
//     itself always comes from the existing Class Management data, so newly
//     created classes appear in the grid automatically.
//   - Time slots come from the Time Slots module (Period rows + Break bands).
//   - Subjects and teachers come from the saved entries (which are themselves
//     resolved from the Class Management Class → Teacher → Subject assignment).
//
// This service never creates, updates or deletes any document. It only reads.

const ACADEMIC_YEAR_REGEX = /^\d{4}$/;
const VALID_GROUPS = [1, 2, 3];

const GROUP_DEFS = [
  { group: 1, label: 'Group 1', note: 'Montessori · Nursery · KG 1 · KG 2' },
  { group: 2, label: 'Group 2', note: 'Class 1 – Class 5' },
  { group: 3, label: 'Group 3', note: 'Class 6 – Class 10' },
];

// Canonical class-name sequence per group. This defines BOTH group membership
// and the preferred column order inside the grid.
const GROUP_NAMES = {
  1: ['Montessori', 'Nursery', 'KG 1', 'KG 2'],
  2: ['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5'],
  3: ['Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'],
};

const normalizeName = (value) => String(value || '').toLowerCase().replace(/\s+/g, '');

// Mirrors the Create Timetable backend derivation. Classes outside the fixed
// enum fall back to their numeric suffix; a class that still cannot be mapped
// is simply excluded from the view (such a class could never be scheduled).
const deriveGroup = (className) => {
  const key = normalizeName(className);

  for (const group of VALID_GROUPS) {
    if (GROUP_NAMES[group].some((name) => normalizeName(name) === key)) return group;
  }

  const numeric = String(className || '').match(/(\d+)/);
  if (numeric) {
    const n = parseInt(numeric[1], 10);
    if (n >= 1 && n <= 5) return 2;
    if (n >= 6 && n <= 10) return 3;
  }

  return null;
};

// Central/default academic year straight from school settings (never hard-coded).
const getCurrentAcademicYear = async () => {
  const settings = await SchoolSettings.getSettings();

  if (settings?.currentAcademicYear && ACADEMIC_YEAR_REGEX.test(String(settings.currentAcademicYear))) {
    return String(settings.currentAcademicYear).trim();
  }

  return String(new Date().getFullYear());
};

const resolveAcademicYear = async (value) => {
  if (value === undefined || value === null || !String(value).trim()) {
    return getCurrentAcademicYear();
  }

  const year = String(value).trim();
  if (!ACADEMIC_YEAR_REGEX.test(year)) {
    throw new ApiError(400, 'Invalid academic year format. Use a valid year (e.g. 2025)');
  }
  return year;
};

const ENTRY_POPULATE = [
  { path: 'classId', select: 'className academicYear status' },
  { path: 'timeSlotId', select: 'startTime endTime type label academicYear status' },
  { path: 'subjectId', select: 'subjectName subjectCode' },
  { path: 'teacherId', select: 'fullName teacherId email status' },
];

const getTimetableDesigner = async (query = {}) => {
  const year = await resolveAcademicYear(query.academicYear);

  let requestedGroup = null;
  if (query.group !== undefined && query.group !== null && String(query.group).trim() !== '') {
    requestedGroup = Number(query.group);
    if (!VALID_GROUPS.includes(requestedGroup)) {
      throw new ApiError(400, 'Invalid group. Allowed: 1, 2, 3');
    }
  }

  // Row axis: every Time Slot of the year (Period + Break), chronological.
  const timeSlots = await TimeSlot.find({ academicYear: year }).lean();
  timeSlots.sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)));

  // Column axis (classes) and engine (saved timetable entries), read in parallel.
  const [classDocs, entryDocs] = await Promise.all([
    Class.find({ academicYear: year, isDeleted: { $ne: true } }).lean(),
    TimetableEntry.find({ academicYear: year, ...(requestedGroup ? { group: requestedGroup } : {}) })
      .populate(ENTRY_POPULATE)
      .lean(),
  ]);

  // Each group block carries its classes (columns) and the per-cell grid.
  const groupsByNumber = {};
  for (const def of GROUP_DEFS) {
    groupsByNumber[def.group] = { ...def, classes: [], entries: [], grid: {} };
  }

  // Bucket classes from Class Management into their group, canonical order.
  for (const cls of classDocs) {
    const group = deriveGroup(cls.className);
    const bucket = groupsByNumber[group];
    if (!bucket) continue;
    bucket.classes.push({ _id: String(cls._id), className: cls.className, status: cls.status });
  }

  for (const group of VALID_GROUPS) {
    groupsByNumber[group].classes.sort((a, b) => {
      const orderOf = (name) => {
        const index = GROUP_NAMES[group].findIndex((candidate) => normalizeName(candidate) === normalizeName(name));
        return index === -1 ? Number.MAX_SAFE_INTEGER : index;
      };
      return orderOf(a.className) - orderOf(b.className);
    });
  }

  // Compose each saved entry into a display-ready cell and slot it into its
  // group's grid at [timeSlotId][classId]. The unique (year, class, slot)
  // index guarantees at most one cell per grid position.
  for (const entry of entryDocs) {
    const slot = entry.timeSlotId;
    const cls = entry.classId;
    if (!slot || !cls) continue;

    const cell = {
      entryId: String(entry._id),
      group: entry.group,
      classId: String(cls._id),
      className: cls.className || null,
      classStatus: cls.status || null,
      timeSlotId: String(slot._id),
      slotLabel: slot.label || '',
      startTime: slot.startTime || null,
      endTime: slot.endTime || null,
      slotType: slot.type || 'PERIOD',
      slotStatus: slot.status || null,
      subjectId: entry.subjectId ? String(entry.subjectId._id) : null,
      subjectName: entry.subjectId?.subjectName || null,
      subjectCode: entry.subjectId?.subjectCode || null,
      teacherId: entry.teacherId ? String(entry.teacherId._id) : null,
      teacherFullName: entry.teacherId?.fullName || null,
      teacherCode: entry.teacherId?.teacherId || null,
    };

    const bucket = groupsByNumber[cell.group];
    if (!bucket) continue;
    bucket.entries.push(cell);
    bucket.grid[cell.timeSlotId] = bucket.grid[cell.timeSlotId] || {};
    bucket.grid[cell.timeSlotId][cell.classId] = cell;
  }

  const groups = requestedGroup ? [groupsByNumber[requestedGroup]] : Object.values(groupsByNumber);

  return { academicYear: year, timeSlots, groups };
};

export default { getTimetableDesigner };