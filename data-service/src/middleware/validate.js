import { AppError } from '../utils/AppError.js';

/**
 * Middleware factory: Validate request using Zod schema.
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @param {'body'|'params'|'query'} source - Which part of request to validate
 */
export function validate(schema, source = 'body') {
  return (req, res, next) => {
    try {
      const data = req[source];
      const result = schema.safeParse(data);

      if (!result.success) {
        const errors = result.error.issues.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        return next(new AppError('Validation error', 400, errors));
      }

      // Replace request data with validated data
      req[source] = result.data;
      next();
    } catch (err) {
      next(err);
    }
  };
}