import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AT_RISK_RESULTS, buildTrainingRows } from '../src/training/trainingRows.js';

const base = {
  modules: [
    { code: 'AAA', presentation: '2013J', lengthDays: 100 },
    { code: 'BBB', presentation: '2013J', lengthDays: 100 },
  ],
  assessments: [
    { assessmentId: 1, moduleCode: 'AAA', presentation: '2013J' },
    { assessmentId: 2, moduleCode: 'BBB', presentation: '2013J' },
    { assessmentId: 3, moduleCode: 'ZZZ', presentation: '2013J' },
  ],
  results: [
    { studentId: 7, assessmentId: 1, score: 80 },
    { studentId: 7, assessmentId: 2, score: 60 },
    { studentId: 8, assessmentId: 1, score: 40 },
    { studentId: 8, assessmentId: 2, score: 30 },
    { studentId: 9, assessmentId: 1, score: 90 },
  ],
  weeklyActivity: [
    { studentId: 7, moduleCode: 'AAA', presentation: '2013J', activeDays: 30 },
    { studentId: 7, moduleCode: 'BBB', presentation: '2013J', activeDays: 20 },
    { studentId: 8, moduleCode: 'AAA', presentation: '2013J', activeDays: 10 },
    { studentId: 8, moduleCode: 'BBB', presentation: '2013J', activeDays: 5 },
  ],
  enrollments: [
    { studentId: 7, moduleCode: 'AAA', presentation: '2013J', finalResult: 'Pass' },
    { studentId: 7, moduleCode: 'BBB', presentation: '2013J', finalResult: 'Distinction' },
    { studentId: 8, moduleCode: 'AAA', presentation: '2013J', finalResult: 'Pass' },
    { studentId: 8, moduleCode: 'BBB', presentation: '2013J', finalResult: 'Withdrawn' },
    { studentId: 9, moduleCode: 'AAA', presentation: '2013J', finalResult: 'Pass' },
  ],
};

describe('buildTrainingRows', () => {
  it('computes the live-endpoint features per student across their enrollments', () => {
    const { rows } = buildTrainingRows(base);
    const student7 = rows.find((row) => row.studentId === 7);

    assert.equal(student7.assessment_score, 0.7);
    assert.equal(student7.completion_rate, 1);
    assert.ok(Math.abs(student7.engagement - 50 / 200) < 1e-12);
  });

  it('labels a student at risk when any enrollment ended in Fail or Withdrawn', () => {
    const { rows } = buildTrainingRows(base);
    const labels = Object.fromEntries(rows.map((row) => [row.studentId, row.at_risk]));

    assert.equal(labels[7], 0);
    assert.equal(labels[8], 1);
    assert.deepEqual([...AT_RISK_RESULTS].sort(), ['Fail', 'Withdrawn']);
  });

  it('skips students whose features cannot be computed and reports the count', () => {
    const { rows, skippedStudents } = buildTrainingRows(base);

    // Every student here has scored assessments in scope, so none are skipped.
    assert.equal(rows.length, 3);
    assert.equal(skippedStudents, 0);

    const noAssessments = buildTrainingRows({
      ...base,
      assessments: [],
      enrollments: [{ studentId: 5, moduleCode: 'AAA', presentation: '2013J', finalResult: 'Pass' }],
    });
    assert.equal(noAssessments.rows.length, 0);
    assert.equal(noAssessments.skippedStudents, 1);
  });
});
