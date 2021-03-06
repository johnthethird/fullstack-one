
import { Service, Container, Inject } from '@fullstack-one/di';
import { Config, IEnvironment } from '@fullstack-one/config';
// import { EventEmitter } from '@fullstack-one/events';
import { ILogger, LoggerFactory } from '@fullstack-one/logger';
import { BootLoader } from '@fullstack-one/boot-loader';

import * as http from 'http';
// other npm dependencies
import * as Koa from 'koa';

@Service()
export class Server {

  private serverConfig;
  private server: http.Server;
  private app: Koa;

  private ENVIRONMENT: IEnvironment;
  private logger: ILogger;
  // private eventEmitter: EventEmitter;

  constructor(
    // @Inject(type => EventEmitter) eventEmitter?,
    @Inject(type => LoggerFactory) loggerFactory?,
    @Inject(type => Config) config?,
    @Inject(tpye => BootLoader) bootLoader?) {

    // register package config
    config.addConfigFolder(__dirname + '/../config');

    // this.eventEmitter = eventEmitter;
    this.logger = loggerFactory.create('Server');

    // get settings from DI container
    this.serverConfig = config.getConfig('server');
    this.ENVIRONMENT = Container.get('ENVIRONMENT');

    this.bootKoa();
    bootLoader.addBootFunction(this.boot.bind(this));

  }

  public getApp() {
    return this.app;
  }

  public getServer() {
    return this.server;
  }

  private async bootKoa(): Promise<void> {
    try {
      this.app = new Koa();
    } catch (e) {
      // tslint:disable-next-line:no-console
      console.error(e);
    }
  }

  private async boot(): Promise<void> {
    try {
      // start KOA on PORT
      this.server = http.createServer(this.app.callback()).listen(this.serverConfig.port);

      // emit event
      this.emit('server.up', this.serverConfig.port);
      // success log
      this.logger.info('Server listening on port', this.serverConfig.port);
    } catch (e) {
      // tslint:disable-next-line:no-console
      console.error(e);
    }
  }

  private emit(eventName: string, ...args: any[]): void {
    // add namespace
    const eventNamespaceName = `${this.ENVIRONMENT.namespace}.${eventName}`;
    // this.eventEmitter.emit(eventNamespaceName, this.ENVIRONMENT.nodeId, ...args);
  }

  private on(eventName: string, listener: (...args: any[]) => void) {
    // add namespace
    const eventNamespaceName = `${this.ENVIRONMENT.namespace}.${eventName}`;
    // this.eventEmitter.on(eventNamespaceName, listener);
  }

}
