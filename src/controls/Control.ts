// @ts-ignore
import { BerWriter } from 'asn1';

export interface ControlOptions {
  critical?: boolean;
}

export abstract class Control {
  public abstract type: string;
  public critical: boolean;

  protected constructor(options: ControlOptions) {
    this.critical = options.critical === true;
  }

  public write(writer: BerWriter): void {
    writer.startSequence();
    writer.writeString(this.type);
    writer.writeBoolean(this.critical);
    this.writeControl(writer);
    writer.endSequence();
  }

  // tslint:disable-next-line:no-empty
  protected writeControl(writer: BerWriter): void {
  }
}
