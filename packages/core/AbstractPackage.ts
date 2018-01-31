import * as F1 from './index';
import { Logger } from './logger';
import { Events, IEventEmitter } from './events';

/*export interface IAbstractPackage {
  // todo
}*/

export abstract class AbstractPackage /*implements IAbstractPackage*/ {

  protected readonly $one: F1.IFullstackOneCore;
  protected readonly logger: Logger;
  protected readonly eventEmitter: IEventEmitter;
  protected readonly CONFIG: any;
  private readonly className: string;

   constructor() {
     this.className = this.constructor.name;
     this.$one = F1.getInstance();
     // get config
     this.CONFIG = this.$one.getConfig(this.className);
     // getSqlFromMigrationObj logger
     this.logger = this.$one.getLogger(`fullstack-one:${this.$one.nodeId}:${this.className}`);
     // get eventemitter
     this.eventEmitter = this.$one.getEventEmitter();
  }

}
