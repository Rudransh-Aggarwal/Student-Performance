// Default '/ml' = same origin: Nginx (production) or the Vite dev proxy forwards it to ml-service.
const ML_SERVICE_URL = import.meta.env.VITE_ML_SERVICE_URL ?? '/ml';

export class MlApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'MlApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function toMlApiError(response) {
  try {
    const payload = await response.json();
    return new MlApiError(
      response.status,
      payload?.error?.code ?? 'UNKNOWN',
      payload?.error?.message ?? payload?.message ?? 'Prediction request failed',
      payload?.error?.details,
    );
  } catch {
    return new MlApiError(response.status, 'UNKNOWN', 'Prediction request failed');
  }
}

export async function predictStudentRisk({ studentId, features }) {
  const response = await fetch(`${ML_SERVICE_URL}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ student_id: studentId, features }),
  });

  if (!response.ok) {
    throw await toMlApiError(response);
  }

  return response.json();
}