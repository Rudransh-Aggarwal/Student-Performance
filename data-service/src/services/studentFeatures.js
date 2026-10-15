const clamp01 = (value) => Math.min(1, Math.max(0, value));

export function calculatePredictionFeatures({ modules, assessments, results, activity }) {
  const scoredResults = results.filter((result) => Number.isFinite(result.score));
  const averageAssessmentScore = scoredResults.length
    ? scoredResults.reduce((sum, result) => sum + result.score, 0) / scoredResults.length
    : null;

  const totalCourseDays = modules.reduce((sum, module) => sum + module.lengthDays, 0);
  const activeDays = activity.reduce((sum, week) => sum + week.activeDays, 0);

  return {
    assessment_score: averageAssessmentScore === null ? null : clamp01(averageAssessmentScore / 100),
    engagement: totalCourseDays > 0 ? clamp01(activeDays / totalCourseDays) : null,
    completion_rate: assessments.length > 0 ? clamp01(scoredResults.length / assessments.length) : null,
  };
}
