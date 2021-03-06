import 'reflect-metadata';
import { IFullstackOneCore } from './IFullstackOneCore';
export declare class FullstackOneCore implements IFullstackOneCore {
    private bootLoader;
    private ENVIRONMENT;
    constructor(bootLoader?: any, config?: any);
    boot(): Promise<void>;
    private cliArt();
}
