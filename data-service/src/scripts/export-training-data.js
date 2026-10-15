import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { buildDataset } from '../oulad/buildDataset.js';
import { buildTrainingRows } from '../training/trainingRows.js';

const USAGE =
  'Usage: npm run export:training -- [--dir ./data/oulad] [--students 1000] [--seed 42] [--out ../ml-service/data/training_features.csv]';

const { values } = parseArgs({
  options: {
    dir: { type: 'string', default: './data/oulad' },
    students: { type: 'string', default: '1000' },
    seed: { type: 'string', default: '42' },
    out: { type: 'string', default: '../ml-service/data/training_features.csv' },
  },
});

const studentCount = Number.parseInt(values.students, 10);
const seed = Number.parseInt(values.seed, 10);
if (!Number.isInteger(studentCount) || studentCount < 1 || !Number.isInteger(seed)) {
  console.error(`--students must be a positive integer and --seed an integer.\n${USAGE}`);
  process.exit(1);
}

const COLUMNS = ['student_id', 'assessment_score', 'engagement', 'completion_rate', 'at_risk'];

function toCsv(rows) {
  const lines = [COLUMNS.join(',')];
  for (const row of rows) {
    lines.push(
      [row.studentId, row.assessment_score.toFixed(6), row.engagement.toFixed(6), row.completion_rate.toFixed(6), row.at_risk].join(
        ',',
      ),
    );
  }
  return `${lines.join('\n')}\n`;
}

async function main() {
  if (existsSync(join(values.dir, 'SYNTHETIC_DATA.txt'))) {
    console.warn('\n*** WARNING: these files are SYNTHETIC (generated), not real OULAD data. ***\n');
  }

  const dataset = await buildDataset({ dir: values.dir, studentCount, seed, onProgress: console.log });
  const { rows, skippedStudents } = buildTrainingRows(dataset);

  const positives = rows.filter((row) => row.at_risk === 1).length;
  await mkdir(dirname(values.out), { recursive: true });
  await writeFile(values.out, toCsv(rows), 'utf8');

  const metaPath = values.out.replace(/\.csv$/, '.meta.json');
  await writeFile(
    metaPath,
    `${JSON.stringify({ synthetic: existsSync(join(values.dir, 'SYNTHETIC_DATA.txt')), students: studentCount, seed, rows: rows.length, skippedStudents }, null, 2)}\n`,
    'utf8',
  );

  console.log(`Wrote ${rows.length} rows to ${values.out}`);
  console.log(`At risk (Fail/Withdrawn): ${positives}; not at risk: ${rows.length - positives}`);
  console.log(`Skipped ${skippedStudents} students with missing features.`);
}

main().catch((error) => {
  console.error('\nExport failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
