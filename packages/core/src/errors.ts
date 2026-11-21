export class PlannerError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'PlannerError';
    this.status = status;
  }
}
