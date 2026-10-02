import { AppError } from '../utils/AppError.js';

export const validateBody = (schema) => (req, _res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return next(new AppError(400, 'VALIDATION_ERROR', 'Invalid request body', result.error.flatten().fieldErrors));
  }
  req.body = result.data;
  return next();
};
