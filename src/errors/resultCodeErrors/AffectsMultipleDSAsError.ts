import { ResultCodeError } from './ResultCodeError';

export class AffectsMultipleDSAsError extends ResultCodeError {
  constructor(message?: string) {
    super(71, message || 'The modify DN operation moves the entry from one LDAP server to another and thus requires more than one LDAP server.');
  }
}
