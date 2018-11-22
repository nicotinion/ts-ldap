import { ResultCodeError } from './ResultCodeError';

export class ConstraintViolationError extends ResultCodeError {
  constructor() {
    super(19, 'The attribute value specified in a Add Request, Modify Request or ModifyDNRequest operation violates constraints placed on the attribute. The constraint can be one of size or content (string only, no binary).');
  }
}
