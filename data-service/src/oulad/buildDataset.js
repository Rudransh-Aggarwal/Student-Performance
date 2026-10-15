import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { WeeklyActivityAggregator } from './aggregate.js';
import { ASSESSMENT_TYPES, FINAL_RESULTS } from './constants.js';
import { readCsv } from './csv.js';
import {
  parseEnum,
  parseFlag,
  parseOptionalNumber,
  parseOptionalText,
  parseRequiredNumber,
  parseRequiredText,
} from './parsers.js';
import { sampleStudentIds } from './sampling.js';

export const FILES = {
  courses: 'courses.csv',
  assessments: 'assessments.csv',
  studentInfo: 'studentInfo.csv',
  studentRegistration: 'studentRegistration.csv',
  studentAssessment: 'studentAssessment.csv',
  studentVle: 'studentVle.csv',
};

// Only the columns we use. gender, region, imd_band and disability are deliberately NOT imported:
// they are sensitive attributes and the models should not see them.
const COLUMNS = {
  courses: ['code_module', 'code_presentation', 'length'],
  assessments: ['code_module', 'code_presentation', 'id_assessment', 'assessment_type', 'date', 'weight'],
  studentInfo: [
    'code_module', 'code_presentation', 'id_student', 'highest_education', 'age_band',
    'num_of_prev_attempts', 'studied_credits', 'final_result',
  ],
  studentRegistration: ['code_module', 'code_presentation', 'id_student', 'date_registration', 'date_unregistration'],
  studentAssessment: ['id_assessment', 'id_student', 'date_submitted', 'is_banked', 'score'],
  studentVle: ['code_module', 'code_presentation', 'id_student', 'date', 'sum_click'],
};

const enrollmentKey = (moduleCode, presentation, studentId) => `${moduleCode}|${presentation}|${studentId}`;

/**
 * Reads the OULAD CSV files, samples students, and returns database-ready documents. Touches no database.
 * @param {{dir: string, studentCount: number, seed: number, onProgress?: (message: string) => void}} options
 */
export async function buildDataset({ dir, studentCount, seed, onProgress = () => {} }) {
  const file = (name) => join(dir, name);

  for (const name of Object.values(FILES)) {
    try {
      await access(file(name));
    } catch {
      throw new Error(`Missing ${name} in ${dir}. Download OULAD and unzip its CSV files there.`);
    }
  }

  // 1. Choose the students.
  const infoRows = [];
  for await (const row of readCsv(file(FILES.studentInfo), COLUMNS.studentInfo)) infoRows.push(row);
  const sampled = sampleStudentIds(
    infoRows.map((row) => parseRequiredNumber(row['id_student'], 'id_student')),
    studentCount,
    seed,
  );
  const sampledText = new Set([...sampled].map(String));
  onProgress(`Sampled ${sampled.size} students (seed ${seed}) from ${infoRows.length} registrations`);

  // 2. Modules and assessments are small; keep them all.
  const modules = [];
  for await (const row of readCsv(file(FILES.courses), COLUMNS.courses)) {
    modules.push({
      code: parseRequiredText(row['code_module'], 'code_module'),
      presentation: parseRequiredText(row['code_presentation'], 'code_presentation'),
      lengthDays: parseRequiredNumber(row['length'], 'length'),
    });
  }

  const assessments = [];
  for await (const row of readCsv(file(FILES.assessments), COLUMNS.assessments)) {
    assessments.push({
      assessmentId: parseRequiredNumber(row['id_assessment'], 'id_assessment'),
      moduleCode: parseRequiredText(row['code_module'], 'code_module'),
      presentation: parseRequiredText(row['code_presentation'], 'code_presentation'),
      type: parseEnum(row['assessment_type'], ASSESSMENT_TYPES, 'assessment_type'),
      dueDay: parseOptionalNumber(row['date']),
      weight: parseRequiredNumber(row['weight'], 'weight'),
    });
  }
  const knownAssessmentIds = new Set(assessments.map((assessment) => assessment.assessmentId));

  // 3. Registrations and enrollments for the sampled students.
  const registrations = new Map();
  for await (const row of readCsv(file(FILES.studentRegistration), COLUMNS.studentRegistration)) {
    if (!sampledText.has(row['id_student'])) continue; // cheap string check before any parsing (hot path: ~10M rows)
    const studentId = parseRequiredNumber(row['id_student'], 'id_student');
    const key = enrollmentKey(
      parseRequiredText(row['code_module'], 'code_module'),
      parseRequiredText(row['code_presentation'], 'code_presentation'),
      studentId,
    );
    registrations.set(key, row);
  }

  const enrollments = [];
  for (const row of infoRows) {
    if (!sampledText.has(row['id_student'])) continue; // cheap string check before any parsing (hot path: ~10M rows)
    const studentId = parseRequiredNumber(row['id_student'], 'id_student');
    const moduleCode = parseRequiredText(row['code_module'], 'code_module');
    const presentation = parseRequiredText(row['code_presentation'], 'code_presentation');
    const registration = registrations.get(enrollmentKey(moduleCode, presentation, studentId));

    enrollments.push({
      studentId,
      moduleCode,
      presentation,
      registeredDay: parseOptionalNumber(registration?.['date_registration']),
      unregisteredDay: parseOptionalNumber(registration?.['date_unregistration']),
      ageBand: parseOptionalText(row['age_band']),
      highestEducation: parseOptionalText(row['highest_education']),
      prevAttempts: parseRequiredNumber(row['num_of_prev_attempts'], 'num_of_prev_attempts'),
      studiedCredits: parseRequiredNumber(row['studied_credits'], 'studied_credits'),
      finalResult: parseEnum(row['final_result'], FINAL_RESULTS, 'final_result'),
    });
  }

  const students = [...sampled].sort((a, b) => a - b).map((externalId) => ({ externalId }));

  // 4. Assessment results (skip rows with no score or an unknown assessment).
  const results = [];
  let skippedResults = 0;
  for await (const row of readCsv(file(FILES.studentAssessment), COLUMNS.studentAssessment)) {
    if (!sampledText.has(row['id_student'])) continue; // cheap string check before any parsing (hot path: ~10M rows)
    const studentId = parseRequiredNumber(row['id_student'], 'id_student');
    const assessmentId = parseRequiredNumber(row['id_assessment'], 'id_assessment');
    const score = parseOptionalNumber(row['score']);
    if (score === null || !knownAssessmentIds.has(assessmentId)) {
      skippedResults += 1;
      continue;
    }
    results.push({
      studentId,
      assessmentId,
      submittedDay: parseOptionalNumber(row['date_submitted']),
      score,
      isBanked: parseFlag(row['is_banked']),
    });
  }
  onProgress(`Read ${results.length} assessment results (${skippedResults} skipped: no score or unknown assessment)`);

  // 5. Clicks: stream millions of daily rows, keep only sampled students, sum per week.
  const aggregator = new WeeklyActivityAggregator();
  let scanned = 0;
  for await (const row of readCsv(file(FILES.studentVle), COLUMNS.studentVle)) {
    scanned += 1;
    if (scanned % 2_000_000 === 0) onProgress(`  scanned ${scanned.toLocaleString()} click rows...`);
    if (!sampledText.has(row['id_student'])) continue; // cheap string check before any parsing (hot path: ~10M rows)
    const studentId = parseRequiredNumber(row['id_student'], 'id_student');
    aggregator.add({
      studentId,
      moduleCode: parseRequiredText(row['code_module'], 'code_module'),
      presentation: parseRequiredText(row['code_presentation'], 'code_presentation'),
      day: parseRequiredNumber(row['date'], 'date'),
      clicks: parseRequiredNumber(row['sum_click'], 'sum_click'),
    });
  }
  const weeklyActivity = aggregator.toRecords();
  onProgress(`Scanned ${scanned.toLocaleString()} click rows into ${weeklyActivity.length} weekly summaries`);

  return { modules, students, enrollments, assessments, results, weeklyActivity };
}
