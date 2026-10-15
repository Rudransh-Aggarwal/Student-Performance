import { createWriteStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import { join } from 'node:path';
import { mulberry32 } from '../oulad/sampling.js';

/*
 * Generates SYNTHETIC files in the exact OULAD CSV layout, so the importer and everything after it can be
 * built and tested without the real download. Nothing here is real student data.
 *
 * Model: every student has a hidden "ability" and "diligence". Diligence drives how often they log in,
 * whether they submit work and whether they withdraw; ability drives scores. The sensitive columns
 * (gender, region, deprivation band, disability) are random and unrelated to outcomes.
 */

const MODULES = {
  AAA: ['2013J', '2014J'],
  BBB: ['2013B', '2013J', '2014B', '2014J'],
  CCC: ['2014B', '2014J'],
  DDD: ['2013B', '2013J', '2014B', '2014J'],
  EEE: ['2013J', '2014B', '2014J'],
  FFF: ['2013B', '2013J', '2014B', '2014J'],
  GGG: ['2013J', '2014B', '2014J'],
};

// [type, weight %, due date as a fraction of the module length]; the weights add up to 100.
const ASSESSMENT_PLAN = [
  ['TMA', 20, 0.15], ['CMA', 10, 0.25], ['TMA', 20, 0.4],
  ['CMA', 10, 0.55], ['TMA', 20, 0.7], ['CMA', 20, 0.85],
];

const EDUCATION = [
  ['No Formal quals', 0.02], ['Lower Than A Level', 0.28], ['A Level or Equivalent', 0.4],
  ['HE Qualification', 0.24], ['Post Graduate Qualification', 0.06],
];
const AGE_BANDS = [['0-35', 0.7], ['35-55', 0.29], ['55<=', 0.01]];
const REGIONS = [
  'East Anglian Region', 'Scotland', 'North Western Region', 'South East Region', 'West Midlands Region',
  'Wales', 'North Region', 'South Region', 'Ireland', 'South West Region', 'East Midlands Region',
  'Yorkshire Region', 'London Region',
];
const IMD_BANDS = ['0-10%', '10-20', '20-30%', '30-40%', '40-50%', '50-60%', '60-70%', '70-80%', '80-90%', '90-100%'];
const CREDITS = [30, 60, 60, 60, 90, 120, 150, 240];

const sigmoid = (x) => 1 / (1 + Math.exp(-x));
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

function makeRandom(seed) {
  const uniform = mulberry32(seed);
  const normal = () => {
    const u = 1 - uniform();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * uniform());
  };
  const int = (low, high) => low + Math.floor(uniform() * (high - low + 1));
  const oneOf = (items) => items[Math.floor(uniform() * items.length)];
  const weighted = (pairs) => {
    let roll = uniform();
    for (const [value, weight] of pairs) {
      roll -= weight;
      if (roll <= 0) return value;
    }
    return pairs[pairs.length - 1][0];
  };
  return { uniform, normal, int, oneOf, weighted };
}

const line = (values) => `${values.join(',')}\n`;

async function writeLine(stream, text) {
  if (!stream.write(text)) await once(stream, 'drain');
}

/**
 * @param {{outDir: string, students: number, seed: number}} options
 * @returns {Promise<{enrollments: number, clickRows: number, outcomes: Record<string, number>}>}
 */
export async function generateOuladCsv({ outDir, students, seed }) {
  const rnd = makeRandom(seed);
  await mkdir(outDir, { recursive: true });

  // Courses and assessments
  const presentations = [];
  const courseRows = [line(['code_module', 'code_presentation', 'length'])];
  const assessmentRows = [line(['code_module', 'code_presentation', 'id_assessment', 'assessment_type', 'date', 'weight'])];
  let nextAssessmentId = 1000;

  for (const [moduleCode, codes] of Object.entries(MODULES)) {
    for (const presentation of codes) {
      const length = presentation.endsWith('B') ? rnd.int(234, 241) : rnd.int(255, 269);
      const plan = ASSESSMENT_PLAN.map(([type, weight, fraction]) => ({
        id: nextAssessmentId++,
        type,
        weight,
        due: Math.round(length * fraction),
      }));
      const exam = { id: nextAssessmentId++, due: rnd.uniform() < 0.5 ? null : length };
      presentations.push({ moduleCode, presentation, length, plan, exam });

      courseRows.push(line([moduleCode, presentation, length]));
      for (const item of plan) {
        assessmentRows.push(line([moduleCode, presentation, item.id, item.type, item.due, item.weight]));
      }
      assessmentRows.push(line([moduleCode, presentation, exam.id, 'Exam', exam.due ?? '?', 100]));
    }
  }

  const infoRows = [line([
    'code_module', 'code_presentation', 'id_student', 'gender', 'region', 'highest_education', 'imd_band',
    'age_band', 'num_of_prev_attempts', 'studied_credits', 'disability', 'final_result',
  ])];
  const registrationRows = [line(['code_module', 'code_presentation', 'id_student', 'date_registration', 'date_unregistration'])];
  const resultRows = [line(['id_assessment', 'id_student', 'date_submitted', 'is_banked', 'score'])];
  const vle = createWriteStream(join(outDir, 'studentVle.csv'));
  await writeLine(vle, line(['code_module', 'code_presentation', 'id_student', 'id_site', 'date', 'sum_click']));

  const outcomes = { Distinction: 0, Pass: 0, Fail: 0, Withdrawn: 0 };
  let enrollments = 0;
  let clickRows = 0;

  for (let i = 0; i < students; i += 1) {
    const studentId = 100000 + i;
    const ability = rnd.normal();
    const diligence = 0.5 * ability + Math.sqrt(0.75) * rnd.normal();
    const gender = rnd.oneOf(['M', 'F']);
    const region = rnd.oneOf(REGIONS);
    const disability = rnd.uniform() < 0.1 ? 'Y' : 'N';
    const ageBand = rnd.weighted(AGE_BANDS);
    const imdBand = rnd.uniform() < 0.05 ? '?' : rnd.oneOf(IMD_BANDS);

    const taking = new Set([rnd.int(0, presentations.length - 1)]);
    if (rnd.uniform() < 0.25) taking.add(rnd.int(0, presentations.length - 1));

    let attempt = 0;
    for (const index of taking) {
      const course = presentations[index];
      const { moduleCode, presentation, length, plan, exam } = course;
      enrollments += 1;

      const withdrawn = rnd.uniform() < sigmoid(-1.35 - 0.85 * diligence - 0.25 * ability);
      const unregDay = withdrawn ? rnd.int(15, Math.floor(length * 0.85)) : null;
      const lastDay = unregDay ?? length;

      // Learning-environment clicks: one or more rows per active day.
      const pActive = clamp(0.22 + 0.13 * diligence + 0.03 * ability, 0.03, 0.9);
      const meanClicks = 3 * Math.exp(0.35 * diligence);
      for (let day = -10; day <= lastDay; day += 1) {
        if (rnd.uniform() >= pActive) continue;
        for (let site = rnd.int(1, 3); site > 0; site -= 1) {
          const clicks = 1 + Math.floor(-Math.log(1 - rnd.uniform()) * meanClicks);
          await writeLine(vle, line([moduleCode, presentation, studentId, 500000 + rnd.int(0, 300), day, clicks]));
          clickRows += 1;
        }
      }

      // Assessments
      const scoreOf = (extraNoise) => clamp(Math.round(56 + 13 * ability + 5 * diligence + (9 + extraNoise) * rnd.normal()), 0, 100);
      const pSubmit = sigmoid(1.9 + 1.1 * diligence);
      let continuous = 0;
      for (const item of plan) {
        if (unregDay !== null && item.due > unregDay) continue;
        if (rnd.uniform() >= pSubmit) continue;
        const late = rnd.uniform() < 0.12 ? rnd.int(1, 6) : 0;
        const submitted = clamp(item.due - rnd.int(0, 4) + late, 0, length);
        const score = scoreOf(0);
        continuous += (score * item.weight) / 100;
        resultRows.push(line([item.id, studentId, submitted, rnd.uniform() < 0.01 ? 1 : 0, score]));
      }

      let examScore = 0;
      if (!withdrawn && rnd.uniform() < 0.96) {
        examScore = scoreOf(3);
        resultRows.push(line([exam.id, studentId, exam.due ?? length, 0, examScore]));
      }

      let finalResult = 'Withdrawn';
      if (!withdrawn) {
        const overall = 0.4 * continuous + 0.6 * examScore;
        finalResult = overall < 40 ? 'Fail' : overall >= 78 ? 'Distinction' : 'Pass';
      }
      outcomes[finalResult] += 1;

      infoRows.push(line([
        moduleCode, presentation, studentId, gender, region, rnd.weighted(EDUCATION), imdBand, ageBand,
        attempt > 0 ? rnd.int(1, 2) : rnd.uniform() < 0.12 ? 1 : 0, rnd.oneOf(CREDITS), disability, finalResult,
      ]));
      registrationRows.push(line([
        moduleCode, presentation, studentId, rnd.uniform() < 0.02 ? '?' : -rnd.int(1, 120), unregDay ?? '',
      ]));
      attempt += 1;
    }
  }

  vle.end();
  await once(vle, 'finish');

  await Promise.all([
    writeFile(join(outDir, 'courses.csv'), courseRows.join('')),
    writeFile(join(outDir, 'assessments.csv'), assessmentRows.join('')),
    writeFile(join(outDir, 'studentInfo.csv'), infoRows.join('')),
    writeFile(join(outDir, 'studentRegistration.csv'), registrationRows.join('')),
    writeFile(join(outDir, 'studentAssessment.csv'), resultRows.join('')),
    writeFile(
      join(outDir, 'SYNTHETIC_DATA.txt'),
      'These CSV files were GENERATED by `npm run generate:sample`. They are NOT real student data.\n' +
        'Replace them with the real OULAD files (see ../../README.md) before reporting any results.\n',
    ),
  ]);

  return { enrollments, clickRows, outcomes };
}
