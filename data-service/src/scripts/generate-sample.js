import { parseArgs } from 'node:util';
import { generateOuladCsv } from '../synthetic/generate.js';

const { values } = parseArgs({
  options: {
    out: { type: 'string', default: './data/oulad' },
    students: { type: 'string', default: '1000' },
    seed: { type: 'string', default: '42' },
  },
});

const students = Number.parseInt(values.students, 10);
const seed = Number.parseInt(values.seed, 10);
if (!Number.isInteger(students) || students < 1 || !Number.isInteger(seed)) {
  console.error('Usage: npm run generate:sample -- [--out ./data/oulad] [--students 1000] [--seed 42]');
  process.exit(1);
}

const summary = await generateOuladCsv({ outDir: values.out, students, seed });
console.log(`Generated SYNTHETIC OULAD-format files in ${values.out}`);
console.log(`  ${students} students, ${summary.enrollments} enrollments, ${summary.clickRows.toLocaleString()} click rows`);
console.log('  outcomes:', summary.outcomes);
console.log('These are not real data. Next: npm run import:oulad -- --students ' + students + ' --reset');
