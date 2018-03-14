"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const di_1 = require("@fullstack-one/di");
const db_1 = require("@fullstack-one/db");
const server_1 = require("@fullstack-one/server");
const boot_loader_1 = require("@fullstack-one/boot-loader");
const config_1 = require("@fullstack-one/config");
const crypto_1 = require("./crypto");
const sign_1 = require("./sign");
// tslint:disable-next-line:no-var-requires
const passport = require('koa-passport');
const KoaRouter = require("koa-router");
const koaBody = require("koa-bodyparser");
const koaSession = require("koa-session");
const oAuthCallback_1 = require("./oAuthCallback");
// import { DbGeneralPool } from '@fullstack-one/db/DbGeneralPool';
let Auth = class Auth {
    constructor(dbGeneralPool, server, bootLoader, config) {
        this.server = server;
        this.dbGeneralPool = dbGeneralPool;
        this.authConfig = config.getConfig('auth');
        this.sodiumConfig = crypto_1.createConfig(this.authConfig.sodium);
        bootLoader.addBootFunction(this.boot.bind(this));
        // this.linkPassport();
    }
    setUser(client, accessToken) {
        return __awaiter(this, void 0, void 0, function* () {
            const payload = sign_1.verifyJwt(accessToken);
            try {
                const values = [payload.userId, payload.userToken, payload.provider, payload.timestamp];
                yield client.query('SELECT _meta.set_user_token($1, $2, $3, $4)', values);
                return true;
            }
            catch (err) {
                throw err;
            }
        });
    }
    loginOrRegister(username, tenant, provider, password, userIdentifier) {
        return __awaiter(this, void 0, void 0, function* () {
            if (provider === 'local') {
                throw new Error('This method is not allowed for local provider.');
            }
            let lData;
            try {
                lData = yield this.login(username, tenant, provider, password, userIdentifier);
                return lData;
                // tslint:disable-next-line:no-empty
            }
            catch (err) { }
            try {
                lData = yield this.register(username, tenant);
                yield this.setPassword(lData.accessToken, provider, password, userIdentifier);
                lData = yield this.login(username, tenant, provider, password, userIdentifier);
                return lData;
            }
            catch (err) {
                throw new Error('User does exist or password is invalid.');
            }
        });
    }
    register(username, tenant) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = yield this.dbGeneralPool.pgPool.connect();
            try {
                // Begin transaction
                yield client.query('BEGIN');
                yield client.query(`SET LOCAL auth.admin_token TO '${sign_1.getAdminSignature()}'`);
                const result = yield client.query('SELECT _meta.register_user($1, $2) AS payload', [username, tenant]);
                const payload = result.rows[0].payload;
                const ret = {
                    userId: payload.userId,
                    payload,
                    accessToken: sign_1.signJwt(payload, payload.userTokenMaxAgeInSeconds)
                };
                yield client.query('COMMIT');
                return ret;
            }
            catch (err) {
                yield client.query('ROLLBACK');
                throw err;
            }
            finally {
                // Release pgClient to pool
                client.release();
            }
        });
    }
    login(username, tenant, provider, password, userIdentifier) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = yield this.dbGeneralPool.pgPool.connect();
            try {
                // Begin transaction
                yield client.query('BEGIN');
                yield client.query(`SET LOCAL auth.admin_token TO '${sign_1.getAdminSignature()}'`);
                const metaResult = yield client.query('SELECT _meta.get_user_pw_meta($1, $2, $3) AS data', [username, provider, tenant]);
                const data = metaResult.rows[0].data;
                const uid = userIdentifier || data.userId;
                const providerSignature = sign_1.getProviderSignature(provider, uid);
                const pwData = yield crypto_1.hashByMeta(password + providerSignature, data.pwMeta);
                yield client.query(`SET LOCAL auth.admin_token TO '${sign_1.getAdminSignature()}'`);
                const loginResult = yield client.query('SELECT _meta.login($1, $2, $3) AS payload', [data.userId, provider, pwData.hash]);
                const payload = loginResult.rows[0].payload;
                const ret = {
                    userId: data.userId,
                    payload,
                    accessToken: sign_1.signJwt(payload, payload.userTokenMaxAgeInSeconds)
                };
                yield client.query('COMMIT');
                return ret;
            }
            catch (err) {
                yield client.query('ROLLBACK');
                throw err;
            }
            finally {
                // Release pgClient to pool
                client.release();
            }
        });
    }
    setPassword(accessToken, provider, password, userIdentifier) {
        return __awaiter(this, void 0, void 0, function* () {
            const payload = sign_1.verifyJwt(accessToken);
            const uid = userIdentifier || payload.userId;
            const providerSignature = sign_1.getProviderSignature(provider, uid);
            const pwData = yield crypto_1.newHash(password + providerSignature, this.sodiumConfig);
            const client = yield this.dbGeneralPool.pgPool.connect();
            try {
                // Begin transaction
                yield client.query('BEGIN');
                const values = [payload.userId, payload.userToken, payload.provider, payload.timestamp, provider, pwData.hash, JSON.stringify(pwData.meta)];
                yield client.query(`SET LOCAL auth.admin_token TO '${sign_1.getAdminSignature()}'`);
                yield client.query('SELECT _meta.set_password($1, $2, $3, $4, $5, $6, $7) AS payload', values);
                yield client.query('COMMIT');
                return true;
            }
            catch (err) {
                yield client.query('ROLLBACK');
                throw err;
            }
            finally {
                // Release pgClient to pool
                client.release();
            }
        });
    }
    forgotPassword(username, tenant) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = yield this.dbGeneralPool.pgPool.connect();
            try {
                // Begin transaction
                yield client.query('BEGIN');
                yield client.query(`SET LOCAL auth.admin_token TO '${sign_1.getAdminSignature()}'`);
                const result = yield client.query('SELECT _meta.forgot_password($1, $2) AS data', [username, tenant]);
                const payload = result.rows[0].data;
                const ret = {
                    userId: payload.userId,
                    payload,
                    accessToken: sign_1.signJwt(payload, payload.userTokenMaxAgeInSeconds)
                };
                yield client.query('COMMIT');
                return ret;
            }
            catch (err) {
                yield client.query('ROLLBACK');
                throw err;
            }
            finally {
                // Release pgClient to pool
                client.release();
            }
        });
    }
    removeProvider(accessToken, provider) {
        return __awaiter(this, void 0, void 0, function* () {
            const payload = sign_1.verifyJwt(accessToken);
            const client = yield this.dbGeneralPool.pgPool.connect();
            try {
                // Begin transaction
                yield client.query('BEGIN');
                yield client.query(`SET LOCAL auth.admin_token TO '${sign_1.getAdminSignature()}'`);
                const values = [payload.userId, payload.userToken, payload.provider, payload.timestamp, provider];
                yield client.query('SELECT _meta.remove_provider($1, $2, $3, $4, $5) AS data', values);
                yield client.query('COMMIT');
                return true;
            }
            catch (err) {
                yield client.query('ROLLBACK');
                throw err;
            }
            finally {
                // Release pgClient to pool
                client.release();
            }
        });
    }
    isTokenValid(accessToken, tempSecret = false, tempTime = false) {
        return __awaiter(this, void 0, void 0, function* () {
            const payload = sign_1.verifyJwt(accessToken);
            const client = yield this.dbGeneralPool.pgPool.connect();
            try {
                // Begin transaction
                yield client.query('BEGIN');
                yield client.query(`SET LOCAL auth.admin_token TO '${sign_1.getAdminSignature()}'`);
                const values = [payload.userId, payload.userToken, payload.provider, payload.timestamp, tempSecret, tempTime];
                const result = yield client.query('SELECT _meta.is_user_token_valid($1, $2, $3, $4, $5, $6) AS data', values);
                const isValid = result.rows[0].data === true;
                yield client.query('COMMIT');
                return isValid;
            }
            catch (err) {
                yield client.query('ROLLBACK');
                throw err;
            }
            finally {
                // Release pgClient to pool
                client.release();
            }
        });
    }
    invalidateUserToken(accessToken) {
        return __awaiter(this, void 0, void 0, function* () {
            const payload = sign_1.verifyJwt(accessToken);
            const client = yield this.dbGeneralPool.pgPool.connect();
            try {
                // Begin transaction
                yield client.query('BEGIN');
                yield client.query(`SET LOCAL auth.admin_token TO '${sign_1.getAdminSignature()}'`);
                const values = [payload.userId, payload.userToken, payload.provider, payload.timestamp];
                yield client.query('SELECT _meta.invalidate_user_token($1, $2, $3, $4) AS data', values);
                yield client.query('COMMIT');
                return true;
            }
            catch (err) {
                yield client.query('ROLLBACK');
                throw err;
            }
            finally {
                // Release pgClient to pool
                client.release();
            }
        });
    }
    invalidateAllUserTokens(accessToken) {
        return __awaiter(this, void 0, void 0, function* () {
            const payload = sign_1.verifyJwt(accessToken);
            const client = yield this.dbGeneralPool.pgPool.connect();
            try {
                // Begin transaction
                yield client.query('BEGIN');
                yield client.query(`SET LOCAL auth.admin_token TO '${sign_1.getAdminSignature()}'`);
                const values = [payload.userId, payload.userToken, payload.provider, payload.timestamp];
                yield client.query('SELECT _meta.invalidate_all_user_tokens($1, $2, $3, $4) AS data', values);
                yield client.query('COMMIT');
                return true;
            }
            catch (err) {
                yield client.query('ROLLBACK');
                throw err;
            }
            finally {
                // Release pgClient to pool
                client.release();
            }
        });
    }
    getPassport() {
        return passport;
    }
    boot() {
        return __awaiter(this, void 0, void 0, function* () {
            const authRouter = new KoaRouter();
            const app = this.server.getApp();
            authRouter.get('/test', (ctx) => __awaiter(this, void 0, void 0, function* () {
                ctx.body = 'Hallo';
            }));
            authRouter.use(koaBody());
            app.keys = [sign_1.getCookieSecret()];
            authRouter.use(koaSession(this.authConfig.oAuth.cookie, app));
            authRouter.use(passport.initialize());
            // authRouter.use(passport.session());
            app.use((ctx, next) => __awaiter(this, void 0, void 0, function* () {
                if (this.authConfig.tokenQueryParameter != null && ctx.request.query[this.authConfig.tokenQueryParameter] != null) {
                    ctx.state.accessToken = ctx.request.query[this.authConfig.tokenQueryParameter];
                    return next();
                }
                if (ctx.request.header.authorization != null && ctx.request.header.authorization.startsWith('Bearer ')) {
                    ctx.state.accessToken = ctx.request.header.authorization.slice(7);
                    return next();
                }
                const accessToken = ctx.cookies.get(this.authConfig.cookie.name, this.authConfig.cookie);
                if (accessToken != null) {
                    ctx.state.accessToken = accessToken;
                }
                return next();
            }));
            authRouter.post('/auth/invalidateAccessToken', (ctx) => __awaiter(this, void 0, void 0, function* () {
                let success;
                try {
                    success = yield this.invalidateUserToken(ctx.state.accessToken);
                }
                catch (err) {
                    success = false;
                    ctx.response.status = 400;
                }
                ctx.body = { success };
            }));
            authRouter.post('/auth/invalidateAllAccessTokens', (ctx) => __awaiter(this, void 0, void 0, function* () {
                let success;
                try {
                    success = yield this.invalidateAllUserTokens(ctx.state.accessToken);
                }
                catch (err) {
                    success = false;
                    ctx.response.status = 400;
                }
                ctx.body = { success };
            }));
            authRouter.post('/auth/register', (ctx) => __awaiter(this, void 0, void 0, function* () {
                if (ctx.request.body.username == null) {
                    ctx.response.status = 400;
                    ctx.body = { success: false, error: '"username" is required.' };
                    return;
                }
                try {
                    const lData = yield this.register(ctx.request.body.username, ctx.request.body.tenant || 'default');
                    ctx.body = Object.assign({}, lData, { success: true });
                }
                catch (err) {
                    ctx.response.status = 400;
                    ctx.body = { success: false, error: 'May this user already exists.' };
                }
            }));
            authRouter.post('/auth/local/login', (ctx) => __awaiter(this, void 0, void 0, function* () {
                if (ctx.request.body.username == null) {
                    ctx.response.status = 400;
                    ctx.body = { success: false, error: '"username" is required.' };
                    return;
                }
                if (ctx.request.body.password == null) {
                    ctx.response.status = 400;
                    ctx.body = { success: false, error: '"password" is required.' };
                    return;
                }
                try {
                    const lData = yield this.login(ctx.request.body.username, ctx.request.body.tenant || 'default', 'local', ctx.request.body.password, null);
                    ctx.body = Object.assign({}, lData, { success: true });
                }
                catch (err) {
                    ctx.response.status = 400;
                    ctx.body = { success: false, error: 'Invalid username, tenant or password.' };
                }
            }));
            authRouter.get('/auth/isAccessTokenValid', (ctx) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const isValid = yield this.isTokenValid(ctx.state.accessToken, false, false);
                    ctx.body = { isValid };
                }
                catch (err) {
                    ctx.response.status = 400;
                    ctx.body = { isValid: false };
                }
            }));
            authRouter.post('/auth/local/setPassword', (ctx) => __awaiter(this, void 0, void 0, function* () {
                if (ctx.request.body.password == null) {
                    ctx.response.status = 400;
                    ctx.body = { success: false, error: '"password" is required.' };
                    return;
                }
                try {
                    const success = yield this.setPassword(ctx.state.accessToken, 'local', ctx.request.body.password, null);
                    ctx.body = { success };
                }
                catch (err) {
                    ctx.response.status = 400;
                    ctx.body = { success: false, error: 'Invalid token.' };
                }
            }));
            authRouter.post('/auth/forgotPassword', (ctx) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const lData = yield this.forgotPassword(ctx.request.body.username, ctx.request.body.tenant || 'default');
                    ctx.body = Object.assign({}, lData, { success: true });
                }
                catch (err) {
                    ctx.body = { success: false };
                    ctx.response.status = 400;
                }
            }));
            authRouter.post('/auth/forgotPassword', (ctx) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const lData = yield this.forgotPassword(ctx.request.body.username, ctx.request.body.tenant || 'default');
                    ctx.body = Object.assign({}, lData, { success: true });
                }
                catch (err) {
                    ctx.body = { success: false };
                    ctx.response.status = 400;
                }
            }));
            authRouter.post('/auth/setCookie', (ctx) => __awaiter(this, void 0, void 0, function* () {
                try {
                    ctx.cookies.set(this.authConfig.cookie.name, ctx.state.accessToken, this.authConfig.cookie);
                    ctx.body = { success: true };
                }
                catch (e) {
                    ctx.body = { success: false };
                }
            }));
            authRouter.get('/auth/oAuthFailure', (ctx) => __awaiter(this, void 0, void 0, function* () {
                const message = {
                    err: 'ERROR_AUTH',
                    data: null
                };
                ctx.body = oAuthCallback_1.default(message, this.authConfig.oAuth.frontendOrigins);
            }));
            authRouter.get('/auth/oAuthSuccess/:data', (ctx) => __awaiter(this, void 0, void 0, function* () {
                const message = {
                    err: null,
                    data: JSON.parse(ctx.params.data)
                };
                ctx.body = oAuthCallback_1.default(message, this.authConfig.oAuth.frontendOrigins);
            }));
            Object.keys(this.authConfig.oAuth.providers).forEach((key) => {
                const provider = this.authConfig.oAuth.providers[key];
                const callbackPath = '/auth/oAuthCallback/' + key;
                const serverApiAddress = this.authConfig.oAuth.serverApiAddress;
                const callbackURL = serverApiAddress + callbackPath;
                const providerConfig = Object.assign({}, provider.config, { callbackURL });
                const providerOptions = Object.assign({ scope: ['email'] }, provider.options, { session: false });
                passport.use(new provider.strategy(providerConfig, (accessToken, refreshToken, profile, cb) => __awaiter(this, void 0, void 0, function* () {
                    try {
                        let email = profile.email || profile._json.email;
                        if (email == null && profile.emails != null && profile.emails[0] != null && profile.emails[0].value != null) {
                            email = profile.emails[0].value;
                        }
                        if (profile == null || email == null || profile.id == null) {
                            throw new Error('Email or id is missing!');
                        }
                        const lData = yield this.loginOrRegister(email, provider.tenant || 'default', provider.name, provider.name, profile.id);
                        cb(null, lData);
                    }
                    catch (err) {
                        cb(err);
                    }
                })));
                authRouter.get('/auth/oAuth/' + key, passport.authenticate(provider.name, providerOptions));
                const errorCatcher = (ctx, next) => __awaiter(this, void 0, void 0, function* () {
                    try {
                        yield next();
                    }
                    catch (err) {
                        // tslint:disable-next-line:no-console
                        console.error(err);
                        ctx.redirect('/auth/oAuthFailure');
                    }
                });
                // tslint:disable-next-line:max-line-length
                authRouter.get(callbackPath, errorCatcher, passport.authenticate(provider.name, { failureRedirect: '/auth/oAuthFailure', session: false }), (ctx) => {
                    ctx.redirect('/auth/oAuthSuccess/' + encodeURIComponent(JSON.stringify(ctx.state.user)));
                });
            });
            app.use(authRouter.routes());
            app.use(authRouter.allowedMethods());
        });
    }
};
Auth = __decorate([
    di_1.Service(),
    __param(0, di_1.Inject(type => db_1.DbGeneralPool)),
    __param(1, di_1.Inject(type => server_1.Server)),
    __param(2, di_1.Inject(type => boot_loader_1.BootLoader)),
    __param(3, di_1.Inject(type => config_1.Config)),
    __metadata("design:paramtypes", [Object, Object, Object, Object])
], Auth);
exports.Auth = Auth;