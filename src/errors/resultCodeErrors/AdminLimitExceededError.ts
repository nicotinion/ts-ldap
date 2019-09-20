import { ResultCodeError } from './ResultCodeError';

export class AdminLimitExceededError extends ResultCodeError {
  constructor(message?: string) {
    super(11, message || 'An LDAP server limit set by an administrative authority has been exceeded.');
  }
}
