/**
 * Collapses OULAD's daily click rows (millions of them) into one row per student, module-presentation and week.
 */
export class WeeklyActivityAggregator {
  constructor() {
    /** @type {Map<string, {studentId: number, moduleCode: string, presentation: string, week: number, clicks: number, days: Set<number>}>} */
    this.buckets = new Map();
  }

  /** @param {{studentId: number, moduleCode: string, presentation: string, day: number, clicks: number}} row */
  add({ studentId, moduleCode, presentation, day, clicks }) {
    const week = Math.floor(day / 7);
    const key = `${moduleCode}|${presentation}|${studentId}|${week}`;
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { studentId, moduleCode, presentation, week, clicks: 0, days: new Set() };
      this.buckets.set(key, bucket);
    }
    bucket.clicks += clicks;
    bucket.days.add(day);
  }

  /** @returns {{studentId: number, moduleCode: string, presentation: string, week: number, clicks: number, activeDays: number}[]} */
  toRecords() {
    return [...this.buckets.values()]
      .map(({ days, ...rest }) => ({ ...rest, activeDays: days.size }))
      .sort(
        (a, b) =>
          a.moduleCode.localeCompare(b.moduleCode) ||
          a.presentation.localeCompare(b.presentation) ||
          a.studentId - b.studentId ||
          a.week - b.week,
      );
  }
}
