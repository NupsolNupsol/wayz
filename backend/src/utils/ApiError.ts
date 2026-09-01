export class ApiError extends Error {
  statusCode: number
  errors?: string[]
  constructor(statusCode: number, message: string, errors?: string[]) {
    super(message)
    this.statusCode = statusCode
    this.errors = errors
    this.name = 'ApiError'
  }
  static badRequest(msg: string, errors?: string[]) {
    return new ApiError(400, msg, errors)
  }
  static unauthorized(msg = 'Unauthorized') {
    return new ApiError(401, msg)
  }
  static forbidden(msg = 'Forbidden') {
    return new ApiError(403, msg)
  }
  static notFound(msg = 'Not found') {
    return new ApiError(404, msg)
  }
  static conflict(msg: string, errors?: string[]) {
    return new ApiError(409, msg, errors)
  }
  static unprocessable(msg: string, errors?: string[]) {
    return new ApiError(422, msg, errors)
  }
}
