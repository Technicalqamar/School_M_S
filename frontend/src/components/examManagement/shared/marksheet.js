import { getImageUrl } from '../../../utils/imageUrl';

export const getInitials = (name) =>
  name
    ? name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'S';

export const gradeBadgeClass = (grade) => {
  switch (grade) {
    case 'A+':
      return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300';
    case 'A':
      return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
    case 'B':
      return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
    case 'C':
      return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300';
    case 'D':
      return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300';
    case 'F':
      return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
    default:
      return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
  }
};

export const statusBadgeClass = (status) => {
  switch (status) {
    case 'Passed':
      return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
    case 'Failed':
      return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
    default:
      return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300';
  }
};

export const buildMarksheetHtml = (record, schoolInfo = {}) => {
  if (!record) return '';
  const addressParts = [schoolInfo.address, schoolInfo.city, schoolInfo.province].filter(Boolean).join(', ');
  const schoolAddress = [addressParts, schoolInfo.country].filter(Boolean).join(', ');
  const schoolContactLine = [
    schoolInfo.contact ? `Ph: ${schoolInfo.contact}` : '',
    schoolInfo.email ? `Email: ${schoolInfo.email}` : '',
    schoolInfo.website ? `Web: ${schoolInfo.website}` : '',
  ].filter(Boolean).join(' &nbsp;|&nbsp; ');
  const schoolRegLine = [
    schoolInfo.registrationNumber ? `Reg. No: ${schoolInfo.registrationNumber}` : '',
    schoolInfo.principalName ? `Principal: ${schoolInfo.principalName}` : '',
  ].filter(Boolean).join(' &nbsp;|&nbsp; ');
  const photoUrl = getImageUrl(record.student.studentImage);
  const generatedOn = new Date().toLocaleString();

  const subjectRows = record.subjectResults
    .map((subj) => {
      const statusText = !subj.entered ? 'Pending' : subj.passed ? 'Pass' : 'Fail';
      const statusCls = !subj.entered ? 'status-pending' : subj.passed ? 'status-pass' : 'status-fail';
      const gradeCell = subj.entered
        ? `<span class="badge grade-${subj.grade.replace('+', 'P')}">${subj.grade}</span>`
        : '<span style="color:#9ca3af;">—</span>';
      return `<tr>
        <td style="text-align:left;font-weight:600;">${subj.subjectName}</td>
        <td>${subj.totalMarks}</td>
        <td>${subj.entered ? subj.obtainedMarks : '<span style="color:#9ca3af;">—</span>'}</td>
        <td>${subj.entered ? `${subj.percentage}%` : '<span style="color:#9ca3af;">—</span>'}</td>
        <td>${gradeCell}</td>
        <td><span class="${statusCls}">${statusText}</span></td>
      </tr>`;
    })
    .join('');

  const overallStatus = record.status || 'Pending';
  const overallStatusClass =
    overallStatus === 'Passed' ? 'val-green' : overallStatus === 'Failed' ? 'val-red' : 'val-amber';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Marksheet - ${record.student.studentId}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: 'Segoe UI', 'Arial', sans-serif; color: #1f2937; background: #f9fafb; font-size: 11px; line-height: 1.4; }
    .sheet { width: 210mm; min-height: 297mm; margin: 0 auto; background: #fff; padding: 9mm 11mm; }
    .frame { border: 2.5px solid #1e3a5f; border-radius: 10px; padding: 5px; }
    .frame-inner { border: 1.4px solid #1e40af; border-radius: 6px; overflow: hidden; }

    /* ── 1. Top Header ─────────────────────────────── */
    .hdr { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 13px 16px 9px; background: linear-gradient(135deg, #f8fafc, #eef2ff); border-bottom: 2px solid #1e3a5f; }
    .hdr-logo { width: 70px; height: 70px; flex-shrink: 0; border: 1.6px solid #1e3a5f; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #fff; }
    .hdr-logo img { width: 100%; height: 100%; object-fit: cover; }
    .hdr-logo .fallback { font-size: 22px; font-weight: 800; color: #1e3a5f; }
    .hdr-main { flex: 1; text-align: center; }
    .hdr-main h1 { font-size: 21px; font-weight: 800; color: #1e3a5f; text-transform: uppercase; letter-spacing: 1.1px; }
    .hdr-main .est { font-size: 9.5px; color: #6b7280; margin-top: 1px; }
    .hdr-main .motto { font-size: 10.5px; color: #475569; font-style: italic; margin-top: 1px; }
    .hdr-side { text-align: right; flex-shrink: 0; }
    .hdr-side p { font-size: 8.5px; color: #6b7280; }
    .hdr-side .gen { font-size: 8px; color: #94a3b8; }
    .hdr-meta { padding: 5px 16px; background: #0f2a52; color: #fff; text-align: center; font-size: 9px; letter-spacing: 0.4px; }
    .hdr-meta span { margin: 0 9px; }

    /* ── Title bar ─────────────────────────────────── */
    .title-bar { text-align: center; padding: 9px 16px 7px; }
    .title-bar h2 { font-size: 16px; font-weight: 800; color: #1e3a5f; text-transform: uppercase; letter-spacing: 1.6px; }
    .title-bar p { font-size: 10px; color: #475569; margin-top: 2px; font-weight: 600; }
    .title-bar .acad { display: inline-block; margin-top: 3px; padding: 1px 10px; border: 0.8px solid #1e40af; border-radius: 12px; color: #1e40af; font-size: 9px; font-weight: 700; background: #eef2ff; }

    /* ── 2. Student Information ────────────────────── */
    .sec { margin: 0 16px 8px; }
    .sec-title { display: flex; align-items: center; gap: 8px; margin: 3px 0 6px; }
    .sec-title .cap { font-size: 11px; font-weight: 800; color: #1e3a5f; text-transform: uppercase; letter-spacing: 0.8px; }
    .sec-title .rule { flex: 1; height: 1.6px; background: #1e40af; }
    .student-row { display: flex; gap: 14px; }
    .photo-box { width: 86px; height: 100px; flex-shrink: 0; border: 1.4px solid #1e3a5f; border-radius: 6px; overflow: hidden; background: #f1f5f9; display: flex; align-items: center; justify-content: center; }
    .photo-box img { width: 100%; height: 100%; object-fit: cover; }
    .photo-box .fallback { font-size: 24px; font-weight: 800; color: #94a3b8; }
    .info-table { flex: 1; width: 100%; border-collapse: collapse; }
    .info-table td { border: 0.8px solid #cbd5e1; padding: 4px 7px; font-size: 10.5px; }
    .info-table .lbl { width: 118px; background: #eef2ff; color: #334155; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; font-size: 8.5px; }
    .info-table .val { color: #111827; font-weight: 600; }

    /* ── 3. Marks table ────────────────────────────── */
    .marks-table { width: 100%; border-collapse: collapse; }
    .marks-table thead th { background: linear-gradient(135deg, #1e3a5f, #1e40af); color: #fff; padding: 6px 7px; text-align: center; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border: 0.8px solid #16294a; }
    .marks-table thead th:first-child { text-align: left; }
    .marks-table tbody td { padding: 5px 7px; border: 0.8px solid #cbd5e1; text-align: center; font-size: 10.5px; }
    .marks-table tbody td:first-child { text-align: left; }
    .marks-table tbody tr:nth-child(even) { background: #f8fafc; }
    .marks-table tbody tr:nth-child(odd) { background: #fff; }
    .badge { display: inline-block; min-width: 24px; padding: 1px 7px; border-radius: 9px; font-size: 9px; font-weight: 700; }
    .grade-AP { background: #d1fae5; color: #065f46; }
    .grade-A { background: #bbf7d0; color: #166534; }
    .grade-B { background: #dbeafe; color: #1e40af; }
    .grade-C { background: #fef9c3; color: #854d0e; }
    .grade-D { background: #ffedd5; color: #c2410c; }
    .grade-F { background: #fee2e2; color: #991b1b; }
    .status-pass { background: #dcfce7; color: #166534; padding: 1px 8px; border-radius: 9px; font-size: 9px; font-weight: 700; }
    .status-fail { background: #fee2e2; color: #991b1b; padding: 1px 8px; border-radius: 9px; font-size: 9px; font-weight: 700; }
    .status-pending { background: #fef9c3; color: #854d0e; padding: 1px 8px; border-radius: 9px; font-size: 9px; font-weight: 700; }

    /* ── 4. Overall Result ─────────────────────────── */
    .overall-grid { display: flex; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; }
    .overall-item { flex: 1; padding: 8px 6px; text-align: center; border-right: 1px solid #cbd5e1; background: #fff; }
    .overall-item:last-child { border-right: none; }
    .overall-item .lbl { font-size: 8px; color: #64748b; text-transform: uppercase; letter-spacing: 0.4px; font-weight: 700; }
    .overall-item .val { font-size: 13px; font-weight: 800; color: #111827; margin-top: 2px; }
    .overall-item .val.blue { color: #2563eb; }
    .overall-item .val.green { color: #16a34a; }
    .overall-item .val.red { color: #dc2626; }
    .overall-item .val.amber { color: #b45309; }
    .val-green { color: #16a34a; }
    .val-red { color: #dc2626; }
    .val-amber { color: #b45309; }

    /* ── 5. Signature area ─────────────────────────── */
    .signatures { display: flex; justify-content: space-between; margin: 34px 16px 0; }
    .signature-box { width: 34%; text-align: center; }
    .signature-box .sig-space { height: 42px; }
    .signature-box .sig-line { border-top: 1.2px solid #1f2937; padding-top: 4px; font-size: 9.5px; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: 0.5px; }
    .signature-box .sig-role { font-size: 8.5px; color: #6b7280; margin-top: 1px; }

    /* ── Footer ────────────────────────────────────── */
    .ftr { margin-top: 10px; padding: 5px 16px 0; border-top: 1px solid #cbd5e1; display: flex; justify-content: space-between; font-size: 7.5px; color: #94a3b8; }

    @media print {
      body { background: #fff; }
      .sheet { margin: 0; width: auto; min-height: auto; padding: 0; }
      .frame, .frame-inner { border-radius: 0; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="frame">
      <div class="frame-inner">
        <!-- 1. Top Header -->
        <div class="hdr">
          <div class="hdr-logo">
            ${schoolInfo.logo ? `<img src="${getImageUrl(schoolInfo.logo)}" alt="School Logo" />` : `<span class="fallback">${getInitials(schoolInfo.name || 'School')}</span>`}
          </div>
          <div class="hdr-main">
            <h1>${schoolInfo.name || 'School Name'}</h1>
            ${schoolAddress ? `<p class="est">${schoolAddress}</p>` : ''}
            ${schoolInfo.shortName ? `<p class="motto">"${schoolInfo.shortName}"</p>` : ''}
          </div>
          <div class="hdr-side">
            ${schoolRegLine ? `<p>${schoolRegLine}</p>` : ''}
            <p class="gen">Generated: ${generatedOn}</p>
          </div>
        </div>
        <div class="hdr-meta">
          ${schoolContactLine ? `<span>${schoolContactLine}</span>` : ''}
        </div>

        <!-- Exam/Result Title -->
        <div class="title-bar">
          <h2>Examination Marksheet</h2>
          <p>${record.exam?.name || 'Exam'} ${record.exam?.type ? `(${record.exam.type})` : ''}</p>
          <span class="acad">Academic Year ${record.academicYear}</span>
        </div>

        <!-- 2. Student Information -->
        <div class="sec">
          <div class="sec-title">
            <span class="cap">Student Information</span>
            <span class="rule"></span>
          </div>
          <div class="student-row">
            <div class="photo-box">
              ${photoUrl ? `<img src="${photoUrl}" alt="Student photo" />` : `<span class="fallback">${getInitials(record.student.fullName)}</span>`}
            </div>
            <table class="info-table">
              <tbody>
                <tr>
                  <td class="lbl">Student Name</td><td class="val">${record.student.fullName}</td>
                  <td class="lbl">Class</td><td class="val">${record.className}</td>
                </tr>
                <tr>
                  <td class="lbl">Father Name</td><td class="val">${record.student.fatherName || '-'}</td>
                  <td class="lbl">Academic Year</td><td class="val">${record.academicYear}</td>
                </tr>
                <tr>
                  <td class="lbl">Student ID</td><td class="val">${record.student.studentId}</td>
                  <td class="lbl">Exam Term</td><td class="val">${record.exam?.type || record.exam?.name || '-'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 3. Marks Table -->
        <div class="sec">
          <div class="sec-title">
            <span class="cap">Marks / Results</span>
            <span class="rule"></span>
          </div>
          <table class="marks-table">
            <thead>
              <tr>
                <th>Subject</th><th>Total Marks</th><th>Obtained Marks</th><th>Percentage</th><th>Grade</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${subjectRows}
            </tbody>
          </table>
        </div>

        <!-- 4. Overall Result -->
        <div class="sec">
          <div class="sec-title">
            <span class="cap">Overall Result</span>
            <span class="rule"></span>
          </div>
          <div class="overall-grid">
            <div class="overall-item">
              <div class="lbl">Total Marks</div>
              <div class="val">${record.totalMarks}</div>
            </div>
            <div class="overall-item">
              <div class="lbl">Obtained Marks</div>
              <div class="val blue">${record.obtainedMarks !== null ? record.obtainedMarks : '—'}</div>
            </div>
            <div class="overall-item">
              <div class="lbl">Overall Percentage</div>
              <div class="val blue">${record.percentage !== null ? `${record.percentage}%` : '—'}</div>
            </div>
            <div class="overall-item">
              <div class="lbl">Overall Grade</div>
              <div class="val">${record.grade}</div>
            </div>
            <div class="overall-item">
              <div class="lbl">Result Status</div>
              <div class="val ${overallStatusClass}">${overallStatus}</div>
            </div>
          </div>
        </div>

        <!-- 5. Signature Area -->
        <div class="signatures">
          <div class="signature-box">
            <div class="sig-space"></div>
            <div class="sig-line">Class Teacher</div>
            <div class="sig-role">Signature</div>
          </div>
          <div class="signature-box">
            <div class="sig-space"></div>
            <div class="sig-line">Principal</div>
            <div class="sig-role">Signature</div>
          </div>
        </div>

        <div class="ftr">
          <span>${schoolInfo.name || 'School'} &mdash; Examination Marksheet</span>
          <span>Page 1 of 1</span>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
};

export const printMarksheet = (html, setPrinting) => {
  if (!html) return;
  setPrinting(true);
  try {
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
  } finally {
    setPrinting(false);
  }
};

export const downloadMarksheetPdf = async (html, filename, setExporting) => {
  if (!html) return;
  setExporting(true);
  try {
    const { default: html2pdf } = await import('html2pdf.js');
    const el = document.createElement('div');
    el.innerHTML = html;
    el.style.position = 'fixed';
    el.style.left = '-9999px';
    el.style.top = '0';
    document.body.appendChild(el);
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
    document.body.removeChild(el);
  } catch {
    document.querySelectorAll('div[style*="left: -9999px"]').forEach((node) => node.remove());
  } finally {
    setExporting(false);
  }
};