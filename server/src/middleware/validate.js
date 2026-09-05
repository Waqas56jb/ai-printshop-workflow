import { ApiError } from '../utils/ApiError.js';

export function validate({ body, query, params } = {}) {
  return (req, _res, next) => {
    try {
      if (body) {
        req.body = body.parse(req.body);
      }
      if (query) {
        Object.defineProperty(req, 'query', {
          value: query.parse(req.query),
          writable: true,
          configurable: true,
        });
      }
      if (params) {
        req.params = params.parse(req.params);
      }
      next();
    } catch (error) {
      if (error?.name === 'ZodError' || error?.issues) {
        return next(new ApiError(400, 'Validation failed', error.issues || error.errors));
      }
      next(error);
    }
  };
}
