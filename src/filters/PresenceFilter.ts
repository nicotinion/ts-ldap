// @ts-ignore
import { BerReader, BerWriter } from 'asn1';
import { Filter } from './Filter';
import { ProtocolOperation } from '../ProtocolOperation';

export interface PresenceFilterOptions {
  attribute?: string;
}

export class PresenceFilter extends Filter {
  public type: ProtocolOperation = ProtocolOperation.FILTER_PRESENT;
  public attribute: string;

  constructor(options: PresenceFilterOptions = {}) {
    super();
    this.attribute = options.attribute || '';
  }

  public parseFilter(reader: BerReader): void {
    this.attribute = reader.buffer.slice(0, reader.length).toString('utf8').toLowerCase();
    reader._offset += reader.length;
  }

  public writeFilter(writer: BerWriter): void {
    // tslint:disable-next-line:no-increment-decrement
    for (let i = 0; i < this.attribute.length; i++) {
      writer.writeByte(this.attribute.charCodeAt(i));
    }
  }

  public matches(objectToCheck: { [index: string]: string } = {}, strictAttributeCase: boolean): boolean {
    const objectToCheckValue = this.getObjectValue(objectToCheck, this.attribute, strictAttributeCase);

    return typeof objectToCheckValue !== 'undefined';
  }

  public toString(): string {
    return `(${this.escape(this.attribute)}=*)`;
  }
}
