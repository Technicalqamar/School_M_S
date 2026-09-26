export const GRADE_SYSTEM = [
  { min: 90, max: 100, grade: 'A+' },
  { min: 80, max: 89, grade: 'A' },
  { min: 70, max: 79, grade: 'B' },
  { min: 60, max: 69, grade: 'C' },
  { min: 50, max: 59, grade: 'D' },
  { min: 0, max: 49, grade: 'F' },
];

export const getGrade = (pct) => {
  if (pct === null || pct === undefined) return '-';
  for (const g of GRADE_SYSTEM) {
    if (pct >= g.min && pct <= g.max) return g.grade;
  }
  return 'F';
};

export const computeStudentResult = ({ student, exam, requiredSubjects, marksData }) => {
  const examId = exam.id;
  const className = student.className;
  const academicYear = exam.academicYear;

  const subjectResults = requiredSubjects.map((subj) => {
    const mark = marksData.find(
      (m) =>
        m.studentId === student.id &&
        m.examId === examId &&
        m.className === className &&
        m.subjectName === subj.subjectName &&
        m.academicYear === academicYear
    );
    return {
      subjectName: subj.subjectName,
      subjectCode: subj.subjectCode,
      totalMarks: subj.totalMarks,
      passingMarks: subj.passingMarks,
      obtainedMarks: mark ? mark.obtainedMarks : null,
      percentage: mark ? Number(((mark.obtainedMarks / subj.totalMarks) * 100).toFixed(1)) : null,
      grade: mark ? getGrade(((mark.obtainedMarks / subj.totalMarks) * 100).toFixed(1)) : '-',
      passed: mark ? mark.obtainedMarks >= subj.passingMarks : false,
      entered: mark !== null && mark !== undefined,
    };
  });

  const totalMarksAll = subjectResults.reduce((sum, s) => sum + s.totalMarks, 0);
  const obtainedMarksAll = subjectResults.filter((s) => s.entered).reduce((sum, s) => sum + s.obtainedMarks, 0);
  const allEntered = subjectResults.every((s) => s.entered);
  const allPassed = subjectResults.every((s) => !s.entered || s.passed);
  const percentage = allEntered ? Number(((obtainedMarksAll / totalMarksAll) * 100).toFixed(1)) : null;

  let status;
  if (!allEntered) {
    status = 'Pending';
  } else if (allPassed) {
    status = 'Passed';
  } else {
    status = 'Failed';
  }

  return {
    student,
    exam,
    className,
    academicYear,
    subjectResults,
    totalMarks: totalMarksAll,
    obtainedMarks: allEntered ? obtainedMarksAll : null,
    percentage,
    grade: percentage !== null ? getGrade(percentage) : '-',
    status,
    allEntered,
  };
};
