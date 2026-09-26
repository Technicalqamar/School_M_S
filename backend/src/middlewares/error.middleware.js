import { ApiError } from '../utils/apiError.js';

const errorHandler = (err, req, res, next) => {
  let statusCode = 500;
  let message = "Internal Server Error";

  if (err) {
    if (err instanceof ApiError) {
      statusCode = err.statusCode;
      message = err.message;
    } else {
      statusCode = err.statusCode || 500;
      message = err.message || "Internal Server Error";
    }
  }

  const response = {
    success: false,
    message,
    errors: err?.errors || [],
    ...(process.env.NODE_ENV === "development" ? { stack: err?.stack } : {}),
  };

  return res.status(statusCode).json(response);
};

export { errorHandler };
