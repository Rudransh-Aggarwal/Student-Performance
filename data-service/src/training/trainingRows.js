import { calculatePredictionFeatures } from '../services/studentFeatures.js';

/** Final results treated as the at-risk outcome (the training label). */
export const AT_RISK_RESULTS = new Set(['Fail', 'Withdrawn']);

const presentationKey = (moduleCode, presentation) => `${moduleCode}|${presentation}`;

function groupBy(items, keyOf) {
  const groups = new Map();
  for (const item of items) {
    const key = keyOf(item);
    const bucket = groups.get(key);
    if (bucket) bucket.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}

/**
 * Builds one labelled row per sampled student. Features use the same function and the same
 * per-student scope as GET /api/data/demo-accounts/me/prediction-features, so training matches serving.
 * Rows with any missing feature are skipped, as the live endpoint would not send them to the model.
 *
 * @returns {{rows: {studentId: number, assessment_score: number, engagement: number, completion_rate: number, at_risk: 0|1}[], skippedStudents: number}}
 */
export function buildTrainingRows({ modules, assessments, results, enrollments, weeklyActivity }) {
  const modulesByPresentation = groupBy(modules, (m) => presentationKey(m.code, m.presentation));
  const assessmentsByPresentation = groupBy(assessments, (a) => presentationKey(a.moduleCode, a.presentation));
  const resultsByStudent = groupBy(results, (r) => r.studentId);
  const activityByStudent = groupBy(weeklyActivity, (w) => w.studentId);
  const enrollmentsByStudent = groupBy(enrollments, (e) => e.studentId);

  const rows = [];
  let skippedStudents = 0;

  for (const [studentId, studentEnrollments] of enrollmentsByStudent) {
    const keys = new Set(studentEnrollments.map((e) => presentationKey(e.moduleCode, e.presentation)));
    const inScope = (item, getKey) => keys.has(getKey(item));

    const studentModules = [...keys].flatMap((key) => modulesByPresentation.get(key) ?? []);
    const studentAssessments = [...keys].flatMap((key) => assessmentsByPresentation.get(key) ?? []);
    const assessmentIds = new Set(studentAssessments.map((a) => a.assessmentId));
    const studentResults = (resultsByStudent.get(studentId) ?? []).filter((r) => assessmentIds.has(r.assessmentId));
    const studentActivity = (activityByStudent.get(studentId) ?? []).filter((w) =>
      inScope(w, (x) => presentationKey(x.moduleCode, x.presentation)),
    );

    const features = calculatePredictionFeatures({
      modules: studentModules,
      assessments: studentAssessments,
      results: studentResults,
      activity: studentActivity,
    });

    if (features.assessment_score === null || features.engagement === null || features.completion_rate === null) {
      skippedStudents += 1;
      continue;
    }

    const atRisk = studentEnrollments.some((e) => AT_RISK_RESULTS.has(e.finalResult));
    rows.push({ studentId, ...features, at_risk: atRisk ? 1 : 0 });
  }

  return { rows, skippedStudents };
}
