export class ApiResponse {
  constructor(data = null, message = 'Success', success = true) {
    this.success = success;
    this.data = data;
    this.message = message;
  }
}

export function sendOk(res, data = null, message = 'Success', status = 200) {
  return res.status(status).json(new ApiResponse(data, message, true));
}

export function sendCreated(res, data = null, message = 'Created') {
  return sendOk(res, data, message, 201);
}
