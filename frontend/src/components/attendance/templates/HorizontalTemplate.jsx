import CardPhoto from './shared/CardPhoto';
import CardInfoRow from './shared/CardInfoRow';
import QRCodeComponent from './shared/QRCodeComponent';
import { getInitials, formatClassName, photoHtml, detailRowHtml, qrImageHtml, cropMarksHtml } from './shared/cardHtmlUtils';

const DEFAULT_VISIBILITY = {
  schoolLogo: true, schoolName: true, studentPhoto: true, studentName: true,
  fatherName: true, studentId: true, class: true, academicYear: true, qrCode: true,
  fatherPhone: true, schoolAddress: true, note: true,
};

const HorizontalTemplateFront = ({ student, schoolInfo, layoutConfig }) => {
  const { cardWidth, cardHeight, borderRadius, photoSize, photoShape, nameFontSize, detailsFontSize, fontWeight, textColor, cardBgColor, primaryColor, secondaryColor } = layoutConfig;
  const visibility = { ...DEFAULT_VISIBILITY, ...(layoutConfig.visibility || {}) };
  const leftWidth = Math.round(cardWidth * 0.38);
  const rightWidth = cardWidth - leftWidth;
  const personType = student?.personType || 'Student';
  const idLabel = personType === 'Teacher' ? 'Teacher ID' : 'Student ID';
  const classLabel = personType === 'Teacher' ? 'Role' : 'Class';
  return (
    <div className="mx-auto overflow-hidden shadow-sm"
      style={{ width: cardWidth, minHeight: cardHeight || undefined, borderRadius, backgroundColor: cardBgColor, border: '1px solid #e5e7eb' }}>
      <div className="flex" style={{ minHeight: cardHeight || 180 }}>
        <div className="flex flex-col items-center"
          style={{ width: leftWidth, padding: '12px 16px', background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}>
          {(visibility.schoolLogo || visibility.schoolName) && (
            <div className="flex items-center justify-center gap-1.5 mb-2">
              {visibility.schoolLogo && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1.5">
                  <path d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342"/>
                </svg>
              )}
              {visibility.schoolName && (
                <span className="text-white font-semibold" style={{ fontSize: 10, letterSpacing: '0.02em' }}>{schoolInfo.name}</span>
              )}
            </div>
          )}
          <div className="flex flex-col items-center justify-center flex-1">
            {visibility.studentPhoto && <CardPhoto fullName={student.fullName} photoSize={Math.min(photoSize, leftWidth - 32)} photoShape={photoShape} image={student.studentImage || student.teacherImage || student.profileImage} />}
            {visibility.studentName && (
              <h3 className="font-bold text-center text-white m-0" style={{ fontSize: nameFontSize, fontWeight, marginTop: 4 }}>
                {student.fullName}
              </h3>
            )}
          </div>
        </div>
        <div className="flex flex-col justify-center" style={{ width: rightWidth, padding: '16px 20px' }}>
          {(visibility.fatherName || visibility.studentId || visibility.class) && (
            <div>
              {visibility.fatherName && <CardInfoRow label="Father" value={student.fatherName || '—'} detailsFontSize={detailsFontSize} fontWeight={fontWeight} textColor={textColor} />}
              {visibility.studentId && <CardInfoRow label={idLabel} value={student.studentId || student.teacherId} detailsFontSize={detailsFontSize} fontWeight={fontWeight} textColor={textColor} />}
              {visibility.class && <CardInfoRow label={classLabel} value={personType === 'Teacher' ? (student.class || 'Teacher') : formatClassName(student.class)} detailsFontSize={detailsFontSize} fontWeight={fontWeight} textColor={textColor} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const HorizontalTemplateBack = ({ student, schoolInfo, layoutConfig }) => {
  const { cardWidth, cardHeight, borderRadius, detailsFontSize, fontWeight, textColor, cardBgColor, primaryColor, secondaryColor, qrSize } = layoutConfig;
  const visibility = { ...DEFAULT_VISIBILITY, ...(layoutConfig.visibility || {}) };
  const leftWidth = Math.round(cardWidth * 0.38);
  const rightWidth = cardWidth - leftWidth;
  return (
    <div className="mx-auto overflow-hidden"
      style={{ width: cardWidth, minHeight: cardHeight || undefined, borderRadius, backgroundColor: cardBgColor, border: '1px solid #e5e7eb' }}>
      <div className="flex" style={{ minHeight: cardHeight || 180 }}>
        <div className="flex flex-col items-center"
          style={{ width: leftWidth, padding: '12px 16px', background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}>
          {(visibility.schoolLogo || visibility.schoolName) && (
            <div className="flex items-center justify-center gap-1.5 mb-2">
              {visibility.schoolLogo && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1.5">
                  <path d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342"/>
                </svg>
              )}
              {visibility.schoolName && (
                <span className="text-white font-semibold" style={{ fontSize: 10, letterSpacing: '0.02em' }}>{schoolInfo.name}</span>
              )}
            </div>
          )}
          <div className="flex flex-col items-center justify-center flex-1">
            {visibility.qrCode && <QRCodeComponent value={student.qrValue} size={Math.min(qrSize, leftWidth - 32)} />}
          </div>
        </div>
        <div className="flex flex-col justify-center" style={{ width: rightWidth, padding: '16px 20px' }}>
          {(visibility.fatherPhone || visibility.schoolAddress) && (
            <div>
              {visibility.fatherPhone && <CardInfoRow label="Phone" value={student.fatherPhone || '—'} detailsFontSize={detailsFontSize} fontWeight={fontWeight} textColor={textColor} />}
              {visibility.schoolAddress && <CardInfoRow label="Address" value={schoolInfo.address} detailsFontSize={detailsFontSize} fontWeight={fontWeight} textColor={textColor} />}
            </div>
          )}
          {visibility.note && (
            <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
              <p className="text-center m-0 text-gray-400 dark:text-gray-500" style={{ fontSize: 8, lineHeight: 1.5 }}>
                This ID card must be carried daily while attending school. Loss of this card should be reported immediately to the school administration.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const HorizontalTemplate = ({ student, schoolInfo, side, layoutConfig = {} }) => {
  const merged = { cardWidth: 520, cardHeight: 0, cardPadding: 16, borderRadius: 12, photoSize: 80, photoShape: 'circle', qrSize: 140, qrPosition: 'center', nameFontSize: 16, detailsFontSize: 12, fontWeight: 700, primaryColor: '#2563eb', secondaryColor: '#1e40af', textColor: '#1f2937', cardBgColor: '#ffffff', ...layoutConfig };
  if (side === 'back') return <HorizontalTemplateBack student={student} schoolInfo={schoolInfo} layoutConfig={merged} />;
  return <HorizontalTemplateFront student={student} schoolInfo={schoolInfo} layoutConfig={merged} />;
};

HorizontalTemplate.toHtml = async (student, schoolInfo, frontConfig = {}, backConfig = {}) => {
  const merge = (cfg) => ({
    cardWidth: 520, cardHeight: 0, borderRadius: 12, photoSize: 80,
    photoShape: 'circle', qrSize: 140, nameFontSize: 16,
    detailsFontSize: 12, fontWeight: 700, primaryColor: '#2563eb', secondaryColor: '#1e40af',
    textColor: '#1f2937', cardBgColor: '#ffffff', ...cfg
  });

  const front = merge(frontConfig);
  const back = merge(backConfig);
  const fVis = { ...DEFAULT_VISIBILITY, ...(frontConfig.visibility || {}) };
  const bVis = { ...DEFAULT_VISIBILITY, ...(backConfig.visibility || {}) };

  const cardWidth = front.cardWidth;
  const commonHeight = Math.max(front.cardHeight || 0, back.cardHeight || 0);
  const leftWidth = Math.round(cardWidth * 0.38);
  const rightWidth = cardWidth - leftWidth;
  const gap = 16;
  const initials = getInitials(student.fullName);
  const personType = student?.personType || 'Student';
  const idLabel = personType === 'Teacher' ? 'Teacher ID' : 'Student ID';
  const classLabel = personType === 'Teacher' ? 'Role' : 'Class';

  let frontRightDetails = '';
  if (fVis.fatherName) frontRightDetails += detailRowHtml('Father', student.fatherName || '—', front.detailsFontSize, front.fontWeight, front.textColor);
  if (fVis.studentId) frontRightDetails += detailRowHtml(idLabel, student.studentId || student.teacherId, front.detailsFontSize, front.fontWeight, front.textColor);
  if (fVis.class) frontRightDetails += detailRowHtml(classLabel, personType === 'Teacher' ? (student.class || 'Teacher') : formatClassName(student.class), front.detailsFontSize, front.fontWeight, front.textColor);

  let backRightDetails = '';
  if (bVis.fatherPhone) backRightDetails += detailRowHtml('Phone', student.fatherPhone || '—', back.detailsFontSize, back.fontWeight, back.textColor);
  if (bVis.schoolAddress) backRightDetails += detailRowHtml('Address', schoolInfo.address, back.detailsFontSize, back.fontWeight, back.textColor);

  const qrBlock = bVis.qrCode
    ? await qrImageHtml(student.qrValue, Math.min(back.qrSize, leftWidth - 32))
    : '';

  const frontSchoolHeader = fVis.schoolLogo || fVis.schoolName
    ? `<div style="display:flex;align-items:center;justify-content:center;gap:4px;margin-bottom:8px;">
        ${fVis.schoolLogo ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="1.5"><path d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342"/></svg>' : ''}
        ${fVis.schoolName ? `<span style="color:white;font-size:10px;font-weight:600;letter-spacing:0.02em;">${schoolInfo.name}</span>` : ''}
      </div>` : '';

  const frontHtml = `
    <div style="height:100%;min-height:${commonHeight || 220}px;border-radius:${front.borderRadius}px;overflow:hidden;background:${front.cardBgColor};border:1px solid #e5e7eb;">
      <table style="border-collapse:collapse;width:100%;">
        <tr>
          <td style="width:${leftWidth}px;vertical-align:top;background:linear-gradient(135deg,${front.primaryColor},${front.secondaryColor});padding:12px 16px;text-align:center;">
            ${frontSchoolHeader}
            ${fVis.studentPhoto ? photoHtml(initials, Math.min(front.photoSize, leftWidth - 32), front.photoShape, student.studentImage || student.teacherImage || student.profileImage) : ''}
            ${fVis.studentName ? `<h3 style="font-size:${front.nameFontSize}px;font-weight:${front.fontWeight};color:white;margin:4px 0 0;">${student.fullName}</h3>` : ''}
          </td>
          <td style="width:${rightWidth}px;vertical-align:middle;padding:16px 20px;">
            ${frontRightDetails ? `<div>${frontRightDetails}</div>` : ''}
          </td>
        </tr>
      </table>
    </div>`;

  const backHtml = `
    <div style="height:100%;min-height:${commonHeight || 220}px;border-radius:${back.borderRadius}px;overflow:hidden;background:${back.cardBgColor};border:1px solid #e5e7eb;">
      <table style="border-collapse:collapse;width:100%;">
        <tr>
          <td style="width:${leftWidth}px;vertical-align:top;background:linear-gradient(135deg,${back.primaryColor},${back.secondaryColor});padding:12px 16px;text-align:center;">
            <div style="display:flex;align-items:center;justify-content:center;margin-bottom:8px;">
              <span style="color:white;font-size:11px;font-weight:700;letter-spacing:0.02em;">QR Scanner</span>
            </div>
            ${qrBlock}
          </td>
          <td style="width:${rightWidth}px;vertical-align:middle;padding:16px 20px;">
            ${backRightDetails ? `<div>${backRightDetails}</div>` : ''}
            ${bVis.note ? `
              <div style="margin-top:8px;padding-top:8px;border-top:1px solid #e5e7eb;">
                <p style="margin:0;text-align:center;font-size:8px;color:#9ca3af;line-height:1.5;">
                  This ID card must be carried daily while attending school. Loss of this card should be reported immediately to the school administration.
                </p>
              </div>` : ''}
          </td>
        </tr>
      </table>
    </div>`;

  const crop = cropMarksHtml();

  return `
    <div style="page-break-after:always;display:flex;justify-content:center;padding:15mm 0;">
      <div style="position:relative;">${crop}${frontHtml}</div>
      <div style="width:${gap}px;flex-shrink:0;"></div>
      <div style="position:relative;">${crop}${backHtml}</div>
    </div>`;
};

export default HorizontalTemplate;
