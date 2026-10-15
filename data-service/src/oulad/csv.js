import { createReadStream } from 'node:fs';
import { parse } from 'csv-parse';

/**
 * Streams a CSV file row by row (studentVle.csv has millions of rows, so never load it whole).
 * @param {string} filePath @param {readonly string[]} requiredColumns
 * @returns {AsyncGenerator<Record<string, string>>}
 */
export async function* readCsv(filePath, requiredColumns) {
  const parser = createReadStream(filePath).pipe(parse({ columns: true, skip_empty_lines: true, bom: true, trim: true }));
  let headerChecked = false;

  for await (const row of parser) {
    if (!headerChecked) {
      const missing = requiredColumns.filter((column) => !(column in row));
      if (missing.length > 0) {
        throw new Error(`${filePath} is missing expected columns: ${missing.join(', ')}`);
      }
      headerChecked = true;
    }
    yield row;
  }
}
