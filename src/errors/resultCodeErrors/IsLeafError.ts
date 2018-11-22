import { ResultCodeError } from './ResultCodeError';

export class IsLeafError extends ResultCodeError {
  constructor() {
    super(35, 'The specified operation cannot be performed on a leaf entry.');
  }
}
