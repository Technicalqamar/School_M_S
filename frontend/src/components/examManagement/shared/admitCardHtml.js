import { getImageUrl } from '../../../utils/imageUrl';

// Shared Admit Card generator.
//
// This module holds the single implementation of the Admit Card printable
// markup, print CSS and print/PDF helpers. The Admin Examination → Admit Card
// page and the Single Student Management workspace both consume it, so a card
// can never render differently depending on where it was opened from. The card
// data itself always comes from the existing admit-card API
// (`GET /api/v1/admit-cards`); nothing here invents or caches a card.

export const formatTime = (t) => {
  if (!t) return '-';
  const [h, m] = String(t).split(':');
  const hour = Number(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
};

export const formatDate = (d) => {
  if (!d) return '-';
  const date = new Date(String(d));
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const formatDay = (d) => {
  if (!d) return '-';
  const date = new Date(String(d));
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-GB', { weekday: 'long' });
};

export const getInitials = (name) =>
  String(name || '')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'S';

export const getSubjectName = (item) => {
  if (item && typeof item.subjectName === 'string' && item.subjectName.trim()) {
    return item.subjectName;
  }
  if (item && item.subjectId && typeof item.subjectId === 'object' && item.subjectId._id) {
    return item.subjectId.subjectName || '-';
  }
  return '-';
};

export const PRINT_CSS = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #111827; }
    .card { max-width: 800px; margin: 20px auto; border: 2px solid #1e40af; border-radius: 12px; overflow: hidden; }
    .header { background: linear-gradient(90deg, #1e40af, #1d4ed8); color: #fff; text-align: center; padding: 18px 24px; }
    .header img { max-height: 56px; margin: 0 auto 6px; display: block; }
    .header h1 { font-size: 22px; }
    .header p { font-size: 12px; margin-top: 4px; opacity: 0.95; }
    .body { padding: 20px 24px; }
    .title-row { display: flex; justify-content: space-between; align-items: center; border: 2px dashed #9ca3af; border-radius: 8px; padding: 8px 14px; margin-bottom: 18px; }
    .title-row .title { font-size: 18px; font-weight: 700; letter-spacing: 2px; color: #1e40af; text-transform: uppercase; }
    .title-row .sub { font-size: 12px; color: #374151; text-align: right; }
    .student { display: flex; gap: 20px; margin-bottom: 18px; }
    .photo { width: 110px; height: 130px; border: 1px solid #d1d5db; border-radius: 8px; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #f3f4f6; }
    .photo img { width: 100%; height: 100%; object-fit: cover; }
    .photo .fallback { font-size: 28px; color: #6b7280; }
    .details { flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 10px 20px; align-content: start; }
    .field .label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
    .field .value { font-size: 14px; font-weight: 600; margin-top: 2px; }
    h3.schedule-title { font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #1e40af; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border: 1px solid #d1d5db; padding: 8px 10px; text-align: left; }
    th { background: #eff6ff; font-size: 11px; text-transform: uppercase; color: #1e3a8a; }
    .sign-box { min-height: 40px; border: 1px dashed #9ca3af; background: #f9fafb; }
    .no-schedule { border: 1px dashed #f59e0b; color: #92400e; background: #fffbeb; padding: 12px; border-radius: 8px; font-size: 13px; text-align: center; }
    .signatures { display: flex; justify-content: space-between; margin-top: 44px; }
    .signature { text-align: center; font-size: 12px; color: #374151; width: 30%; }
    .signature .line { border-top: 1px solid #374151; padding-top: 6px; }
    .footer-note { text-align: center; font-size: 11px; color: #9ca3af; margin-top: 12px; }
    @media print { .print-break { page-break-after: always; } }
  `;

export const buildAdmitCardHtml = (admitCard, schoolInfo = {}) => {
  if (!admitCard) return '';
  const { student, schedules = [], exam, academicYear: year, className: cls } = admitCard;
  if (!student) return '';
  const addressParts = [schoolInfo.address, schoolInfo.city, schoolInfo.province]
    .filter(Boolean)
    .join(', ');
  const schoolAddress = [addressParts, schoolInfo.country].filter(Boolean).join(', ');
  const contactLine = [schoolInfo.contact, schoolInfo.email, schoolInfo.website]
    .filter(Boolean)
    .join('  •  ');
  const photoUrl = getImageUrl(student.studentImage);

  const scheduleRows = schedules
    .map(
      (s) => `
      <tr>
        <td>${formatDate(s.examDate)}</td>
        <td>${formatDay(s.examDate)}</td>
        <td>${getSubjectName(s)}</td>
        <td>${formatTime(s.startTime)}</td>
        <td>${formatTime(s.endTime)}</td>
        <td class="sign-box"></td>
      </tr>`,
    )
    .join('');

  return `<div class="card">
    <div class="header">
      ${schoolInfo.logo ? `<img src="${getImageUrl(schoolInfo.logo)}" alt="School logo" />` : ''}
      <h1>${schoolInfo.name || 'School Name'}</h1>
      <p>${[schoolAddress, schoolInfo.registrationNumber ? `Reg. No: ${schoolInfo.registrationNumber}` : ''].filter(Boolean).join('  •  ')}</p>
      ${contactLine ? `<p>${contactLine}</p>` : ''}
      ${schoolInfo.principalName ? `<p>Principal: ${schoolInfo.principalName}</p>` : ''}
    </div>
    <div class="body">
      <div class="title-row">
        <span class="title">Admit Card</span>
        <span class="sub"><strong>${exam?.name || 'Exam'}</strong> • Year: ${year}</span>
      </div>
      <div class="student">
        <div class="photo">
          ${photoUrl ? `<img src="${photoUrl}" alt="Student photo" />` : `<span class="fallback">${getInitials(student.fullName || 'S')}</span>`}
        </div>
        <div class="details">
          <div class="field"><div class="label">Student Name</div><div class="value">${student.fullName || '-'}</div></div>
          <div class="field"><div class="label">Father's Name</div><div class="value">${student.fatherName || '-'}</div></div>
          <div class="field"><div class="label">Student ID</div><div class="value">${student.studentId || '-'}</div></div>
          <div class="field"><div class="label">Class</div><div class="value">${cls}</div></div>
          <div class="field"><div class="label">Academic Year</div><div class="value">${year}</div></div>
          <div class="field"><div class="label">Exam</div><div class="value">${exam?.name || '-'}</div></div>
        </div>
      </div>
      <h3 class="schedule-title">Exam Schedule</h3>
      ${
        schedules.length > 0
          ? `<table>
              <thead>
                <tr><th>Date</th><th>Day</th><th>Exam / Subject</th><th>Start Time</th><th>End Time</th><th>Teacher Signature</th></tr>
              </thead>
              <tbody>${scheduleRows}</tbody>
            </table>`
          : `<div class="no-schedule">No exam schedule has been published for this exam and class yet.</div>`
      }
      <div class="signatures">
        <div class="signature"><div class="line">Student Signature</div></div>
        <div class="signature"><div class="line">Class Teacher</div></div>
        <div class="signature"><div class="line">Exam Controller</div></div>
      </div>
      <div class="footer-note">This is a computer-generated admit card.</div>
    </div>
  </div>`;
};

export const buildAdmitCardPrintableHtml = (admitCard, schoolInfo = {}) => {
  if (!admitCard) return '';
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Admit Card - ${admitCard.student?.studentId || ''}</title>
  <style>${PRINT_CSS}</style>
</head>
<body>
  ${buildAdmitCardHtml(admitCard, schoolInfo)}
</body>
</html>`;
};

export const buildAdmitCardsPrintableHtml = (admitCards, schoolInfo = {}) => {
  if (!admitCards || admitCards.length === 0) return '';
  const cardsHtml = admitCards
    .map((card) => `<div class="print-break">${buildAdmitCardHtml(card, schoolInfo)}</div>`)
    .join('');
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Admit Cards - ${admitCards[0]?.className || 'Class'}</title>
  <style>${PRINT_CSS}</style>
</head>
<body>
  ${cardsHtml}
</body>
</html>`;
};

export const printHtml = (html) => {
  if (!html) return;
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    window.print();
    return;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 500);
};

export const downloadAdmitCardPdf = async (html, filename) => {
  if (!html) return false;
  const { default: html2pdf } = await import('html2pdf.js');
  const el = document.createElement('div');
  el.innerHTML = html;
  el.style.position = 'fixed';
  el.style.left = '-9999px';
  el.style.top = '0';
  document.body.appendChild(el);
  try {
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
    return true;
  } finally {
    document.body.removeChild(el);
  }
};

export default {
  PRINT_CSS,
  buildAdmitCardHtml,
  buildAdmitCardPrintableHtml,
  buildAdmitCardsPrintableHtml,
  printHtml,
  downloadAdmitCardPdf,
};
