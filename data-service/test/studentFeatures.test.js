import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calculatePredictionFeatures } from '../src/services/studentFeatures.js';

describe('student prediction features', () => {
  it('normalizes assessment score and caps course activity and completion at one', () => {
    const features = calculatePredictionFeatures({
      modules: [{ lengthDays: 100 }],
      assessments: [{ assessmentId: 1 }, { assessmentId: 2 }],
      results: [{ score: 80 }, { score: 100 }, { score: null }],
      activity: [{ activeDays: 60 }, { activeDays: 60 }],
    });

    assert.deepEqual(features, {
      assessment_score: 0.9,
      engagement: 1,
      completion_rate: 1,
    });
  });

  it('reports missing signals as null rather than inventing zero-valued observations', () => {
    const features = calculatePredictionFeatures({
      modules: [],
      assessments: [],
      results: [],
      activity: [],
    });

    assert.deepEqual(features, {
      assessment_score: null,
      engagement: null,
      completion_rate: null,
    });
  });

  it('keeps features within the expected normalized range', () => {
    const features = calculatePredictionFeatures({
      modules: [{ lengthDays: 200 }],
      assessments: [{ assessmentId: 1 }],
      results: [{ score: 120 }],
      activity: [{ activeDays: 250 }],
    });

    assert.deepEqual(features, {
      assessment_score: 1,
      engagement: 1,
      completion_rate: 1,
    });
  });
});
