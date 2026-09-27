import { getImageUrl } from '../../../utils/imageUrl';

// Timetable Designer — Print / PDF.
//
// Builds a SELF-CONTAINED A4 document (no app chrome, no sidebar, no buttons)
// from the SAME real Designer data used on screen: the selected academic year,
// one group, its class columns and the saved timetable entries. Nothing here is
// generated, stubbed or modified — it is a pure view of the Designer payload.
//
// Mirrors the app's established print/PDF convention (marksheet / fee reports):
//   Print -> standalone HTML in a blank popup window + window.print()
//   PDF   -> html2pdf.js on an off-screen clone of the same HTML

/** Escape dynamic text so it can never break out of the generated document. */
const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const getInitials = (name) =>
  name
    ? name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'S';

const toDate = (time) => {
  if (!time) return null;
  const date = new Date(`1970-01-01T${String(time).trim()}:00`);
  return isNaN(date.getTime()) ? null : date;
};

/** Formats a "HH:mm" slot time like the app's formatClock (12h by default). */
export const formatSlotTime = (time, timeFormat = '12') => {
  const date = toDate(time);
  if (!date) return String(time ?? '—');
  const hour12 = String(timeFormat || '12') === '12';
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12 });
};

/**
 * Build the full printable HTML document for ONE group of the Timetable.
 *
 * @param {object} input
 * @param {string} input.academicYear
 * @param {number|string} input.group
 * @param {string} input.label      e.g. "Group 1"
 * @param {string} input.note       e.g. "Montessori · Nursery · KG 1 · KG 2"
 * @param {Array}  input.timeSlots  Designer time slots (Period + Break), chronological
 * @param {Array}  input.classes    Designer class columns [{_id,className,status}]
 * @param {object} input.grid       Designer grid [slotId][classId] -> cell
 * @param {object} input.schoolInfo School Settings fields (from useSchoolConfig)
 * @param {string} input.timeFormat "12" | "24"
 */
export const buildTimetablePrintHtml = ({
  academicYear,
  group,
  label,
  note,
  timeSlots = [],
  classes = [],
  grid = {},
  schoolInfo = {},
  timeFormat = '12',
}) => {
  if (!academicYear || !classes.length) return '';

  const addressParts = [schoolInfo.address, schoolInfo.city, schoolInfo.province].filter(Boolean).join(', ');
  const schoolAddress = [addressParts, schoolInfo.country].filter(Boolean).join(', ');
  const schoolContactLine = [
    schoolInfo.contact ? `Ph: ${schoolInfo.contact}` : '',
    schoolInfo.email ? `Email: ${schoolInfo.email}` : '',
    schoolInfo.website ? `Web: ${schoolInfo.website}` : '',
  ]
    .filter(Boolean)
    .join(' &nbsp;|&nbsp; ');
  const schoolRegLine = [
    schoolInfo.registrationNumber ? `Reg. No: ${schoolInfo.registrationNumber}` : '',
    schoolInfo.principalName ? `Principal: ${schoolInfo.principalName}` : '',
  ]
    .filter(Boolean)
    .join(' &nbsp;|&nbsp; ');
  const logoUrl = getImageUrl(schoolInfo.logo);
  const generatedOn = new Date().toLocaleString();
  const groupKey = Number(group) || group;

  const headerClasses = classes
    .map((cls) => {
      const inactive = String(cls.status || '').toLowerCase() !== 'active';
      return `<th>${esc(cls.className)}${inactive ? `<span class="cls-status">${esc(cls.status)}</span>` : ''}</th>`;
    })
    .join('');

  const slotRows = timeSlots
    .map((slot) => {
      const slotId = String(slot._id);
      const timeText = `${formatSlotTime(slot.startTime, timeFormat)} – ${formatSlotTime(slot.endTime, timeFormat)}`;
      const isBreak = String(slot.type || '').toUpperCase() === 'BREAK';

      if (isBreak) {
        return `<tr class="break-row">
          <td class="time-cell">${timeText}</td>
          <td class="break-band" colspan="${Math.max(classes.length, 1)}">
            <span class="break-badge">BREAK</span>
            <span class="break-label">${esc(slot.label || 'Break')}</span>
            <span class="break-time">(${timeText})</span>
          </td>
        </tr>`;
      }

      const cells = classes
        .map((cls) => {
          const cell = grid?.[slotId]?.[String(cls._id)];
          if (!cell) return '<td>&nbsp;</td>';
          return `<td>
            <span class="teacher">${esc(cell.teacherFullName || '—')}</span>
            <span class="subject">${esc(cell.subjectName || '—')}</span>
          </td>`;
        })
        .join('');

      const slotLabel = slot.label ? `<span class="time-label">${esc(slot.label)}</span>` : '';
      return `<tr><td class="time-cell">${timeText}${slotLabel}</td>${cells}</tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Timetable - ${esc(label || `Group ${groupKey}`)} - ${esc(academicYear)}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: 'Segoe UI', 'Arial', sans-serif; color: #1f2937; background: #f9fafb; font-size: 11px; line-height: 1.4; }
    .sheet { width: 210mm; min-height: 297mm; margin: 0 auto; background: #fff; padding: 9mm 10mm; }
    .frame { border: 2.2px solid #1e3a5f; border-radius: 10px; padding: 5px; }
    .frame-inner { border: 1.2px solid #1e40af; border-radius: 6px; overflow: hidden; }

    /* -- School header -------------------------------------- */
    .hdr { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px 8px; background: linear-gradient(135deg, #f8fafc, #eef2ff); border-bottom: 2px solid #1e3a5f; }
    .hdr-logo { width: 64px; height: 64px; flex-shrink: 0; border: 1.5px solid #1e3a5f; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #fff; }
    .hdr-logo img { width: 100%; height: 100%; object-fit: cover; }
    .hdr-logo .fallback { font-size: 20px; font-weight: 800; color: #1e3a5f; }
    .hdr-main { flex: 1; text-align: center; }
    .hdr-main h1 { font-size: 19px; font-weight: 800; color: #1e3a5f; text-transform: uppercase; letter-spacing: 1px; }
    .hdr-main .est { font-size: 9px; color: #6b7280; margin-top: 1px; }
    .hdr-main .motto { font-size: 10px; color: #475569; font-style: italic; margin-top: 1px; }
    .hdr-side { text-align: right; flex-shrink: 0; }
    .hdr-side p { font-size: 8.5px; color: #6b7280; }
    .hdr-meta { padding: 4px 14px; background: #0f2a52; color: #fff; text-align: center; font-size: 8.5px; letter-spacing: 0.3px; }

    /* -- Title bar ------------------------------------------- */
    .title-bar { text-align: center; padding: 9px 14px 8px; }
    .title-bar h2 { font-size: 15px; font-weight: 800; color: #1e3a5f; text-transform: uppercase; letter-spacing: 1.4px; }
    .title-bar .note { font-size: 9.5px; color: #475569; margin-top: 2px; font-weight: 600; }
    .title-bar .acad { display: inline-block; margin-top: 4px; padding: 1px 10px; border: 0.8px solid #1e40af; border-radius: 12px; color: #1e40af; font-size: 9px; font-weight: 700; background: #eef2ff; }

    /* -- Timetable grid --------------------------------------- */
    .tt-wrap { margin: 0 10px 6px; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; }
    .tt { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .tt thead { display: table-header-group; }
    .tt thead th { background: linear-gradient(135deg, #1e3a5f, #1e40af); color: #fff; padding: 6px 4px; text-align: center; font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; border: 0.8px solid #16294a; }
    .tt thead th:first-child { width: 20%; }
    .tt thead .cls-status { display: block; font-size: 6.5px; font-weight: 600; color: #fcd34d; text-transform: none; letter-spacing: 0; margin-top: 1px; }
    .tt tbody td { padding: 5px 4px; border: 0.8px solid #cbd5e1; text-align: center; font-size: 9.5px; vertical-align: top; word-wrap: break-word; }
    .tt tbody tr:nth-child(even) td { background: #f8fafc; }
    .tt tbody tr:nth-child(odd) td { background: #fff; }

    .time-cell { font-weight: 700; color: #111827; white-space: nowrap; }
    .time-label { display: block; font-size: 8px; font-weight: 400; color: #6b7280; }
    .teacher { display: block; font-weight: 700; color: #111827; font-size: 9px; }
    .subject { display: block; font-size: 8.5px; color: #4b5563; margin-top: 1px; }

    .break-row td { background: #fffbeb !important; border-color: #fde68a; font-weight: 700; color: #92400e; }
    .break-row .time-cell { font-size: 8.5px; }
    .break-row .break-band { text-align: left; font-size: 9px; letter-spacing: 0.3px; }
    .break-badge { display: inline-block; background: #fef3c7; border: 0.8px solid #f59e0b; color: #92400e; border-radius: 8px; padding: 0 7px; font-weight: 800; font-size: 8px; letter-spacing: 0.6px; margin-right: 6px; }
    .break-label { font-weight: 700; color: #92400e; }
    .break-time { font-weight: 400; color: #b45309; margin-left: 6px; }

    /* -- Footer ------------------------------------------------ */
    .ftr { margin-top: 8px; padding: 5px 14px 0; border-top: 1px solid #cbd5e1; display: flex; justify-content: space-between; font-size: 7.5px; color: #94a3b8; }

    @media print {
      body { background: #fff; }
      .sheet { margin: 0; width: auto; min-height: auto; padding: 0; }
      .frame, .frame-inner { border-radius: 0; }
      .tt tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="frame">
      <div class="frame-inner">
        <!-- 1. School header (dynamic School Settings) -->
        <div class="hdr">
          <div class="hdr-logo">
            ${logoUrl ? `<img src="${logoUrl}" alt="${esc(schoolInfo.name || 'School')} logo" />` : `<span class="fallback">${getInitials(schoolInfo.name)}</span>`}
          </div>
          <div class="hdr-main">
            <h1>${esc(schoolInfo.name || 'School Name')}</h1>
            ${schoolAddress ? `<p class="est">${esc(schoolAddress)}</p>` : ''}
            ${schoolInfo.shortName ? `<p class="motto">"${esc(schoolInfo.shortName)}"</p>` : ''}
          </div>
          <div class="hdr-side">
            ${schoolRegLine ? `<p>${schoolRegLine}</p>` : ''}
            ${schoolContactLine ? `<p>${schoolContactLine}</p>` : ''}
          </div>
        </div>

        <!-- 2. Timetable title -->
        <div class="title-bar">
          <h2>Timetable - ${esc(label || `Group ${groupKey}`)}</h2>
          ${note ? `<p class="note">${esc(note)}</p>` : ''}
          <span class="acad">Academic Year ${esc(academicYear)}</span>
        </div>

        <!-- 3. Timetable grid: Time + class columns, cells = teacher + subject -->
        <div class="tt-wrap">
          <table class="tt">
            <thead>
              <tr><th>Time</th>${headerClasses}</tr>
            </thead>
            <tbody>
              ${slotRows}
            </tbody>
          </table>
        </div>

        <!-- 4. Footer -->
        <div class="ftr">
          <span>${esc(schoolInfo.name || 'School')} &mdash; Timetable - ${esc(label || `Group ${groupKey}`)}</span>
          <span>Academic Year ${esc(academicYear)} &middot; Generated: ${esc(generatedOn)}</span>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
};

/** Open a blank print window with the standalone document and print it. */
export const printTimetable = (html) => {
  if (!html) return;
  const printWindow = window.open('', '_blank');
  // If a popup is blocked, fall back to the browser's default print dialog.
  if (!printWindow) {
    window.print();
    return;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 650);
};

/** Download the same standalone document as a PDF via html2pdf (A4 portrait). */
export const downloadTimetablePdf = async (html, filename) => {
  if (!html) return;
  const el = document.createElement('div');
  el.innerHTML = html;
  el.style.position = 'fixed';
  el.style.left = '-9999px';
  el.style.top = '0';
  document.body.appendChild(el);
  try {
    const { default: html2pdf } = await import('html2pdf.js');
    await html2pdf()
      .set({
        margin: [8, 8, 8, 8],
        filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      })
      .from(el)
      .save();
  } finally {
    document.body.removeChild(el);
  }
};