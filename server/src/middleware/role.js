import { ApiError } from '../utils/ApiError.js';

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user?.role) {
      return next(new ApiError(401, 'Unauthorized'));
    }
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, 'Insufficient permissions'));
    }
    next();
  };
}
