import { ResultCodeError } from './ResultCodeError';

export class InvalidSyntaxError extends ResultCodeError {
  constructor(message?: string) {
    super(21, message || 'The attribute value specified in an Add Request, Compare Request, or Modify Request operation is an unrecognized or invalid syntax for the attribute.');
  }
}
