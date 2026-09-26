import { getInitials, gradeBadgeClass, statusBadgeClass } from './marksheet';
import { getImageUrl } from '../../../utils/imageUrl';

const MarksheetPreview = ({ record, schoolInfo = {} }) => {
  if (!record) return null;
  const photoUrl = getImageUrl(record.student.studentImage);
  const overallStatus = record.status || 'Pending';
  const addressParts = [schoolInfo.address, schoolInfo.city, schoolInfo.province].filter(Boolean).join(', ');
  const schoolAddress = [addressParts, schoolInfo.country].filter(Boolean).join(', ');
  const contactLine = [
    schoolInfo.contact ? `Ph: ${schoolInfo.contact}` : '',
    schoolInfo.email ? `Email: ${schoolInfo.email}` : '',
    schoolInfo.website ? `Web: ${schoolInfo.website}` : '',
  ].filter(Boolean).join('  •  ');
  const regLine = [
    schoolInfo.registrationNumber ? `Reg. No: ${schoolInfo.registrationNumber}` : '',
    schoolInfo.principalName ? `Principal: ${schoolInfo.principalName}` : '',
  ].filter(Boolean).join('  •  ');

  const subjectStatusPill = (subj) => {
    if (!subj.entered) {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">Pending</span>;
    }
    if (subj.passed) {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">Pass</span>;
    }
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">Fail</span>;
  };

  const overallStatusPill = () => {
    const cls = statusBadgeClass(overallStatus);
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${cls}`}>
        {overallStatus}
      </span>
    );
  };

  return (
    <div className="max-w-[210mm] mx-auto bg-white dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-300 dark:border-gray-600 p-3 sm:p-4" id="marksheet-preview">
      <div className="border-2 border-blue-900 dark:border-blue-500 rounded-lg p-1.5">
        <div className="border border-blue-700 dark:border-blue-400 rounded overflow-hidden">
          {/* 1. Top Header */}
          <div className="flex items-center justify-between gap-4 px-4 sm:px-6 py-4 bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-gray-700 dark:to-gray-800 border-b-2 border-blue-900 dark:border-blue-500">
            <div className="w-16 h-16 sm:w-[70px] sm:h-[70px] flex-shrink-0 rounded-full border-2 border-blue-900 dark:border-blue-500 overflow-hidden flex items-center justify-center bg-white dark:bg-gray-700">
              {schoolInfo.logo ? (
                <img src={getImageUrl(schoolInfo.logo)} alt="School Logo" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl font-extrabold text-blue-900 dark:text-blue-300">{getInitials(schoolInfo.name || 'School')}</span>
              )}
            </div>
            <div className="flex-1 text-center">
              <h3 className="text-lg sm:text-xl font-extrabold text-blue-900 dark:text-blue-300 uppercase tracking-wider">{schoolInfo.name || 'School Name'}</h3>
              {schoolAddress && <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{schoolAddress}</p>}
              {schoolInfo.shortName && <p className="text-xs italic text-gray-600 dark:text-gray-300 mt-0.5">&quot;{schoolInfo.shortName}&quot;</p>}
            </div>
            <div className="text-right flex-shrink-0 text-[10px] text-gray-500 dark:text-gray-400 leading-relaxed hidden sm:block">
              {regLine && <p>{regLine}</p>}
              <p className="text-gray-400 dark:text-gray-500">Generated: {new Date().toLocaleString()}</p>
            </div>
          </div>
          <div className="px-4 sm:px-6 py-1.5 bg-blue-950 dark:bg-blue-900 text-white text-center text-[10px] tracking-wide">
            {contactLine && <span>{contactLine}</span>}
          </div>

          {/* Exam/Result Title */}
          <div className="text-center px-4 sm:px-6 pt-4 pb-2">
            <h4 className="text-base sm:text-lg font-extrabold text-blue-900 dark:text-blue-300 uppercase tracking-widest">Examination Marksheet</h4>
            <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5 font-semibold">{record.exam?.name || 'Exam'} {record.exam?.type ? `(${record.exam.type})` : ''}</p>
            <span className="inline-block mt-1 px-3 py-0.5 rounded-full border border-blue-600 dark:border-blue-400 text-blue-700 dark:text-blue-300 text-[11px] font-bold bg-indigo-50 dark:bg-indigo-900/30">Academic Year {record.academicYear}</span>
          </div>

          <div className="px-4 sm:px-6 space-y-4">
            {/* 2. Student Information */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-extrabold text-blue-900 dark:text-blue-300 uppercase tracking-wider">Student Information</span>
                <span className="flex-1 h-0.5 bg-blue-700 dark:bg-blue-500" />
              </div>
              <div className="flex gap-3 sm:gap-4">
                <div className="w-[80px] h-[96px] sm:w-[86px] sm:h-[100px] flex-shrink-0 rounded-md border border-blue-900 dark:border-blue-500 overflow-hidden flex items-center justify-center bg-slate-100 dark:bg-gray-700">
                  {photoUrl ? (
                    <img src={photoUrl} alt="Student" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl font-extrabold text-gray-400 dark:text-gray-500">{getInitials(record.student.fullName)}</span>
                  )}
                </div>
                <div className="flex-1 overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <tbody>
                      <tr>
                        <td className="border border-slate-300 dark:border-gray-600 px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 font-bold text-gray-600 dark:text-gray-300 uppercase text-[9px] tracking-wide w-[110px]">Student Name</td>
                        <td className="border border-slate-300 dark:border-gray-600 px-2.5 py-1.5 font-semibold text-gray-900 dark:text-white">{record.student.fullName}</td>
                        <td className="border border-slate-300 dark:border-gray-600 px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 font-bold text-gray-600 dark:text-gray-300 uppercase text-[9px] tracking-wide w-[110px]">Class</td>
                        <td className="border border-slate-300 dark:border-gray-600 px-2.5 py-1.5 font-semibold text-gray-900 dark:text-white">{record.className}</td>
                      </tr>
                      <tr>
                        <td className="border border-slate-300 dark:border-gray-600 px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 font-bold text-gray-600 dark:text-gray-300 uppercase text-[9px] tracking-wide">Father Name</td>
                        <td className="border border-slate-300 dark:border-gray-600 px-2.5 py-1.5 font-semibold text-gray-900 dark:text-white">{record.student.fatherName || '—'}</td>
                        <td className="border border-slate-300 dark:border-gray-600 px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 font-bold text-gray-600 dark:text-gray-300 uppercase text-[9px] tracking-wide">Acad. Year</td>
                        <td className="border border-slate-300 dark:border-gray-600 px-2.5 py-1.5 font-semibold text-gray-900 dark:text-white">{record.academicYear}</td>
                      </tr>
                      <tr>
                        <td className="border border-slate-300 dark:border-gray-600 px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 font-bold text-gray-600 dark:text-gray-300 uppercase text-[9px] tracking-wide">Student ID</td>
                        <td className="border border-slate-300 dark:border-gray-600 px-2.5 py-1.5 font-semibold text-gray-900 dark:text-white">{record.student.studentId}</td>
                        <td className="border border-slate-300 dark:border-gray-600 px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 font-bold text-gray-600 dark:text-gray-300 uppercase text-[9px] tracking-wide">Exam Term</td>
                        <td className="border border-slate-300 dark:border-gray-600 px-2.5 py-1.5 font-semibold text-gray-900 dark:text-white">{record.exam?.type || record.exam?.name || '—'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* 3. Marks Table */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-extrabold text-blue-900 dark:text-blue-300 uppercase tracking-wider">Marks / Results</span>
                <span className="flex-1 h-0.5 bg-blue-700 dark:bg-blue-500" />
              </div>
              <div className="overflow-x-auto rounded-lg border border-slate-300 dark:border-gray-600">
                <table className="w-full text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-gradient-to-r from-blue-900 to-blue-700 dark:from-blue-800 dark:to-blue-600">
                      <th className="text-left px-3.5 py-2 text-[10px] font-bold text-white uppercase tracking-wider">Subject</th>
                      <th className="px-3.5 py-2 text-center text-[10px] font-bold text-white uppercase tracking-wider">Total Marks</th>
                      <th className="px-3.5 py-2 text-center text-[10px] font-bold text-white uppercase tracking-wider">Obtained Marks</th>
                      <th className="px-3.5 py-2 text-center text-[10px] font-bold text-white uppercase tracking-wider">Percentage</th>
                      <th className="px-3.5 py-2 text-center text-[10px] font-bold text-white uppercase tracking-wider">Grade</th>
                      <th className="px-3.5 py-2 text-center text-[10px] font-bold text-white uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {record.subjectResults.map((subj, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-slate-50 dark:bg-gray-700/40'}>
                        <td className="border-b border-slate-200 dark:border-gray-700 px-3.5 py-2 font-semibold text-gray-900 dark:text-white">{subj.subjectName}</td>
                        <td className="border-b border-slate-200 dark:border-gray-700 px-3.5 py-2 text-center text-gray-700 dark:text-gray-300">{subj.totalMarks}</td>
                        <td className="border-b border-slate-200 dark:border-gray-700 px-3.5 py-2 text-center text-gray-700 dark:text-gray-300">{subj.entered ? subj.obtainedMarks : '—'}</td>
                        <td className="border-b border-slate-200 dark:border-gray-700 px-3.5 py-2 text-center text-gray-700 dark:text-gray-300">{subj.entered ? `${subj.percentage}%` : '—'}</td>
                        <td className="border-b border-slate-200 dark:border-gray-700 px-3.5 py-2 text-center">
                          {subj.entered ? (
                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-md text-xs font-bold ${gradeBadgeClass(subj.grade)}`}>{subj.grade}</span>
                          ) : '—'}
                        </td>
                        <td className="border-b border-slate-200 dark:border-gray-700 px-3.5 py-2 text-center">{subjectStatusPill(subj)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 4. Overall Result */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-extrabold text-blue-900 dark:text-blue-300 uppercase tracking-wider">Overall Result</span>
                <span className="flex-1 h-0.5 bg-blue-700 dark:bg-blue-500" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 divide-x divide-y sm:divide-y-0 divide-slate-300 dark:divide-gray-600 border border-slate-300 dark:border-gray-600 rounded-lg overflow-hidden">
                <div className="p-3 text-center">
                  <p className="text-[9px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-bold mb-0.5">Total Marks</p>
                  <p className="text-lg font-extrabold text-gray-900 dark:text-white">{record.totalMarks}</p>
                </div>
                <div className="p-3 text-center">
                  <p className="text-[9px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-bold mb-0.5">Obtained Marks</p>
                  <p className="text-lg font-extrabold text-blue-600 dark:text-blue-400">{record.obtainedMarks !== null ? record.obtainedMarks : '—'}</p>
                </div>
                <div className="p-3 text-center">
                  <p className="text-[9px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-bold mb-0.5">Overall Percentage</p>
                  <p className="text-lg font-extrabold text-blue-600 dark:text-blue-400">{record.percentage !== null ? `${record.percentage}%` : '—'}</p>
                </div>
                <div className="p-3 text-center">
                  <p className="text-[9px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-bold mb-0.5">Overall Grade</p>
                  <span className={`inline-flex items-center justify-center w-10 h-10 rounded-lg text-sm font-bold ${gradeBadgeClass(record.grade)}`}>{record.grade}</span>
                </div>
                <div className="p-3 text-center">
                  <p className="text-[9px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-bold mb-0.5">Result Status</p>
                  {overallStatusPill()}
                </div>
              </div>
            </div>

            {/* 5. Signature Area */}
            <div className="flex justify-between pt-10 pb-2 gap-6">
              <div className="text-center w-1/3">
                <div className="h-10" />
                <div className="border-t-2 border-gray-800 dark:border-gray-200 pt-1.5 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Class Teacher</div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Signature</div>
              </div>
              <div className="text-center w-1/3">
                <div className="h-10" />
                <div className="border-t-2 border-gray-800 dark:border-gray-200 pt-1.5 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Principal</div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Signature</div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-2 px-4 sm:px-6 py-2 border-t border-slate-200 dark:border-gray-700 flex justify-between text-[9px] text-gray-400 dark:text-gray-500">
            <span>{schoolInfo.name || 'School'} — Examination Marksheet</span>
            <span>Page 1 of 1</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarksheetPreview;