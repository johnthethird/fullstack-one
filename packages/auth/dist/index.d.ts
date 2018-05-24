import { LoggerFactory } from '@fullstack-one/logger';
export * from './signHelper';
export declare class Auth {
    private sodiumConfig;
    private authConfig;
    private notificationFunction;
    private dbGeneralPool;
    private logger;
    private server;
    private graphQl;
    private schemaBuilder;
    constructor(dbGeneralPool?: any, server?: any, bootLoader?: any, schemaBuilder?: any, config?: any, graphQl?: any, loggerFactory?: LoggerFactory);
    setNotificationFunction(notificationFunction: any): void;
    setUser(client: any, accessToken: any): Promise<boolean>;
    loginOrRegister(username: any, tenant: any, provider: any, password: any, userIdentifier: any): Promise<any>;
    register(username: any, tenant: any, meta: any): Promise<boolean>;
    login(username: any, tenant: any, provider: any, password: any, userIdentifier: any): Promise<{
        userId: any;
        payload: any;
        accessToken: any;
    }>;
    setPassword(accessToken: any, provider: any, password: any, userIdentifier: any): Promise<boolean>;
    forgotPassword(username: any, tenant: any, meta: any): Promise<boolean>;
    removeProvider(accessToken: any, provider: any): Promise<boolean>;
    isTokenValid(accessToken: any, tempSecret?: boolean, tempTime?: boolean): Promise<boolean>;
    invalidateUserToken(accessToken: any): Promise<boolean>;
    invalidateAllUserTokens(accessToken: any): Promise<boolean>;
    getPassport(): any;
    createDbClientAdminTransaction(dbClient: any): Promise<any>;
    createDbClientUserTransaction(dbClient: any, accessToken: any): Promise<any>;
    getCurrentUserIdFromClient(dbClient: any): Promise<any>;
    getCurrentUserIdFromAccessToken(accessToken: any): Promise<any>;
    adminTransaction(callback: any): Promise<any>;
    adminQuery(...queryArguments: any[]): Promise<any>;
    userTransaction(accessToken: any, callback: any): Promise<any>;
    userQuery(accessToken: any, ...queryArguments: any[]): Promise<any>;
    private addMiddleware();
    private boot();
    private preQueryHook(client, context, authRequired);
    private getResolvers();
}
