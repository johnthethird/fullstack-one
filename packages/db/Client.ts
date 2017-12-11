import * as F1 from '../core';
import { IDb } from './IDb';
import { Client as PgClient, ClientConfig as PgClientConfig } from 'pg';
export { PgClient };

export class DbClient extends F1.AbstractPackage implements IDb {
  public readonly client: PgClient;
  private credentials;

  constructor(
    $one: F1.IFullstackOneCore,
    pCredentials: PgClientConfig
  ) {
    super($one);

    this.credentials  = pCredentials;
    this.client       = new PgClient(this.credentials);
  }

  public async create(): Promise<PgClient> {

    try {
      // create connection
      await this.client.connect();
      this.logger.info('Postgres connection created');
    } catch (err) {
      throw err;
    }

    return this.client;
  }

  public async end(): Promise<void> {
    return await this.client.end();
  }

}