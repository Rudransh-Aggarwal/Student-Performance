import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { buildDataset } from '../src/oulad/buildDataset.js';
import { generateOuladCsv } from '../src/synthetic/generate.js';

const mean = (numbers) => numbers.reduce((sum, n) => sum + n, 0) / numbers.length;

describe('synthetic OULAD-format generator', () => {
  let dir;
  let summary;
  let dataset;

  before(async () => {
    dir = await mkdtemp(join(tmpdir(), 'synthetic-'));
    summary = await generateOuladCsv({ outDir: dir, students: 400, seed: 7 });
    dataset = await buildDataset({ dir, studentCount: 400, seed: 1 });
  });

  after(() => rm(dir, { recursive: true, force: true }));

  it('is reproducible for the same seed', async () => {
    const other = await mkdtemp(join(tmpdir(), 'synthetic-again-'));
    await generateOuladCsv({ outDir: other, students: 400, seed: 7 });
    for (const name of ['studentInfo.csv', 'studentAssessment.csv', 'studentVle.csv']) {
      assert.equal(await readFile(join(dir, name), 'utf8'), await readFile(join(other, name), 'utf8'), name);
    }
    await rm(other, { recursive: true, force: true });
  });

  it('marks its output as synthetic', async () => {
    await access(join(dir, 'SYNTHETIC_DATA.txt'));
  });

  it('round-trips through the importer with consistent references', () => {
    assert.equal(dataset.students.length, 400);
    assert.equal(dataset.enrollments.length, summary.enrollments);
    assert.equal(dataset.modules.length, 22);

    const assessmentIds = new Set(dataset.assessments.map((a) => a.assessmentId));
    const studentIds = new Set(dataset.students.map((s) => s.externalId));
    assert.ok(dataset.results.length > 0 && dataset.weeklyActivity.length > 0);
    assert.ok(dataset.results.every((r) => assessmentIds.has(r.assessmentId) && r.score >= 0 && r.score <= 100));
    assert.ok(dataset.weeklyActivity.every((w) => studentIds.has(w.studentId) && w.clicks > 0 && w.activeDays >= 1));
  });

  it('produces all four outcomes, and withdrawals carry an unregistration day', () => {
    const outcomes = new Set(dataset.enrollments.map((e) => e.finalResult));
    assert.deepEqual([...outcomes].sort(), ['Distinction', 'Fail', 'Pass', 'Withdrawn']);
    for (const enrollment of dataset.enrollments) {
      assert.equal(enrollment.unregisteredDay !== null, enrollment.finalResult === 'Withdrawn');
    }
  });

  it('contains a real signal: engaged students do better (so models have something to learn)', () => {
    const clicksByEnrollment = new Map();
    for (const w of dataset.weeklyActivity) {
      const key = `${w.studentId}|${w.moduleCode}|${w.presentation}`;
      clicksByEnrollment.set(key, (clicksByEnrollment.get(key) ?? 0) + w.clicks);
    }
    const meanClicks = (result) =>
      mean(
        dataset.enrollments
          .filter((e) => e.finalResult === result)
          .map((e) => clicksByEnrollment.get(`${e.studentId}|${e.moduleCode}|${e.presentation}`) ?? 0),
      );
    assert.ok(meanClicks('Pass') > meanClicks('Withdrawn'), 'Pass should out-click Withdrawn');
    assert.ok(meanClicks('Distinction') > meanClicks('Fail'), 'Distinction should out-click Fail');
  });
});
