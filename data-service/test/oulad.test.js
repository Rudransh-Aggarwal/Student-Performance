import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { WeeklyActivityAggregator } from '../src/oulad/aggregate.js';
import { buildDataset } from '../src/oulad/buildDataset.js';
import { parseEnum, parseOptionalNumber, parseRequiredNumber } from '../src/oulad/parsers.js';
import { sampleStudentIds } from '../src/oulad/sampling.js';

// Headers copied from the OULAD documentation; values include the "?" / blank cases the real files contain.
const FIXTURE = {
  'courses.csv': `code_module,code_presentation,length
AAA,2013J,268
BBB,2013B,240
`,
  'assessments.csv': `code_module,code_presentation,id_assessment,assessment_type,date,weight
AAA,2013J,1752,TMA,19,10
AAA,2013J,1758,Exam,?,100
BBB,2013B,14984,CMA,54,20
`,
  'studentInfo.csv': `code_module,code_presentation,id_student,gender,region,highest_education,imd_band,age_band,num_of_prev_attempts,studied_credits,disability,final_result
AAA,2013J,11,M,East Anglian Region,HE Qualification,90-100%,55<=,0,240,N,Pass
AAA,2013J,12,F,Scotland,A Level or Equivalent,?,35-55,0,60,N,Withdrawn
BBB,2013B,13,F,London Region,Lower Than A Level,20-30%,0-35,1,60,Y,Fail
`,
  'studentRegistration.csv': `code_module,code_presentation,id_student,date_registration,date_unregistration
AAA,2013J,11,-159,
AAA,2013J,12,-53,34
BBB,2013B,13,?,
`,
  'studentAssessment.csv': `id_assessment,id_student,date_submitted,is_banked,score
1752,11,18,0,78
1752,12,22,0,?
1758,11,?,0,90
14984,13,55,1,35
9999,11,1,0,50
`,
  'studentVle.csv': `code_module,code_presentation,id_student,id_site,date,sum_click
AAA,2013J,11,546614,-5,3
AAA,2013J,11,546614,0,4
AAA,2013J,11,546615,3,2
AAA,2013J,11,546614,7,5
AAA,2013J,99,546614,1,9
`,
};

describe('parsers', () => {
  it('treats "?" and blanks as missing', () => {
    assert.equal(parseOptionalNumber('?'), null);
    assert.equal(parseOptionalNumber(''), null);
    assert.equal(parseOptionalNumber(undefined), null);
    assert.equal(parseOptionalNumber(' -159 '), -159);
    assert.throws(() => parseRequiredNumber('?', 'x'), /"x"/);
  });

  it('rejects unexpected enum values', () => {
    assert.equal(parseEnum('Pass', ['Pass', 'Fail'], 'r'), 'Pass');
    assert.throws(() => parseEnum('Maybe', ['Pass', 'Fail'], 'r'), /Maybe/);
  });
});

describe('sampling', () => {
  const ids = Array.from({ length: 100 }, (_, i) => i + 1);

  it('is reproducible and returns the requested number of distinct ids', () => {
    const a = sampleStudentIds(ids, 10, 42);
    const b = sampleStudentIds(ids, 10, 42);
    assert.equal(a.size, 10);
    assert.deepEqual([...a].sort((x, y) => x - y), [...b].sort((x, y) => x - y));
    assert.ok([...a].every((id) => ids.includes(id)));
  });

  it('ignores duplicate ids and caps at the population size', () => {
    assert.equal(sampleStudentIds([1, 1, 2, 2, 3], 10, 1).size, 3);
  });
});

describe('weekly aggregation', () => {
  it('buckets days into weeks, sums clicks and counts distinct active days', () => {
    const aggregator = new WeeklyActivityAggregator();
    const base = { studentId: 1, moduleCode: 'AAA', presentation: '2013J' };
    aggregator.add({ ...base, day: -5, clicks: 3 });
    aggregator.add({ ...base, day: 0, clicks: 4 });
    aggregator.add({ ...base, day: 3, clicks: 2 });
    aggregator.add({ ...base, day: 3, clicks: 1 }); // same day again: clicks add, active days do not
    aggregator.add({ ...base, day: 7, clicks: 5 });
    assert.deepEqual(
      aggregator.toRecords().map(({ week, clicks, activeDays }) => [week, clicks, activeDays]),
      [[-1, 3, 1], [0, 7, 2], [1, 5, 1]],
    );
  });
});

describe('buildDataset with an OULAD-shaped fixture', () => {
  let dir;
  let dataset;

  before(async () => {
    dir = await mkdtemp(join(tmpdir(), 'oulad-'));
    await Promise.all(Object.entries(FIXTURE).map(([name, text]) => writeFile(join(dir, name), text)));
    dataset = await buildDataset({ dir, studentCount: 10, seed: 42 });
  });

  after(() => rm(dir, { recursive: true, force: true }));

  it('loads modules, assessments and every student when the sample is larger than the population', () => {
    assert.equal(dataset.modules.length, 2);
    assert.deepEqual(dataset.students.map((s) => s.externalId), [11, 12, 13]);
    const exam = dataset.assessments.find((a) => a.assessmentId === 1758);
    assert.deepEqual([exam.type, exam.dueDay, exam.weight], ['Exam', null, 100]);
  });

  it('joins registration data onto enrollments and keeps the outcome', () => {
    const byStudent = Object.fromEntries(dataset.enrollments.map((e) => [e.studentId, e]));
    assert.deepEqual(
      [byStudent[11].registeredDay, byStudent[11].unregisteredDay, byStudent[11].finalResult, byStudent[11].studiedCredits],
      [-159, null, 'Pass', 240],
    );
    assert.deepEqual([byStudent[12].unregisteredDay, byStudent[12].finalResult], [34, 'Withdrawn']);
    assert.deepEqual([byStudent[13].registeredDay, byStudent[13].prevAttempts], [null, 1]);
  });

  it('does not import sensitive attributes', () => {
    for (const enrollment of dataset.enrollments) {
      for (const field of ['gender', 'region', 'imdBand', 'imd_band', 'disability']) {
        assert.ok(!(field in enrollment), `${field} must not be imported`);
      }
    }
  });

  it('keeps scored results for known assessments only', () => {
    assert.deepEqual(
      dataset.results.map((r) => [r.studentId, r.assessmentId, r.submittedDay, r.score, r.isBanked]),
      [[11, 1752, 18, 78, false], [11, 1758, null, 90, false], [13, 14984, 55, 35, true]],
    );
  });

  it('aggregates clicks per week for sampled students only', () => {
    assert.deepEqual(
      dataset.weeklyActivity.map((w) => [w.studentId, w.week, w.clicks, w.activeDays]),
      [[11, -1, 3, 1], [11, 0, 6, 2], [11, 1, 5, 1]],
    );
  });

  it('samples a subset when asked for fewer students', async () => {
    const small = await buildDataset({ dir, studentCount: 2, seed: 7 });
    assert.equal(small.students.length, 2);
    const ids = new Set(small.students.map((s) => s.externalId));
    assert.ok(small.enrollments.every((e) => ids.has(e.studentId)));
  });
});

describe('buildDataset error messages', () => {
  it('names the missing file', async () => {
    const empty = await mkdtemp(join(tmpdir(), 'oulad-empty-'));
    await assert.rejects(buildDataset({ dir: empty, studentCount: 1, seed: 1 }), /Missing courses\.csv/);
    await rm(empty, { recursive: true, force: true });
  });

  it('names missing columns', async () => {
    const bad = await mkdtemp(join(tmpdir(), 'oulad-bad-'));
    await Promise.all(Object.entries(FIXTURE).map(([name, text]) => writeFile(join(bad, name), text)));
    await writeFile(join(bad, 'studentInfo.csv'), 'code_module,code_presentation\nAAA,2013J\n');
    await assert.rejects(buildDataset({ dir: bad, studentCount: 1, seed: 1 }), /missing expected columns: .*id_student/);
    await rm(bad, { recursive: true, force: true });
  });
});
