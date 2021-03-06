"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const di_1 = require("@fullstack-one/di");
const DebugLogger = require("debug-logger");
// import * as LE from 'le_node';
const Tracer = require("tracer");
class Logger {
    constructor(moduleName = 'root', loggerConfig) {
        this.LEVELS = ['trace', 'debug', 'info', 'warn', 'error'];
        // tracer
        // any should avoid: TS2409:Return type of constructor signature must be assignable to the instance type of the class.
        this.tracerLogger = null;
        // debug
        this.debugLogger = null;
        const env = di_1.Container.get('ENVIRONMENT');
        // const config: any = Container.get('CONFIG');
        this.loggerName = `${env.namespace}:${env.nodeId}:${moduleName}`;
        this.projectEnvString = `${env.name}/V.${env.version}/ENV:${env.NODE_ENV}/I:${env.nodeId}`;
        // setup tracer
        const tracerConfig = {
            // min level
            level: loggerConfig.minLevel,
            // set log levels
            methods: this.LEVELS,
            // override tracer transport with logToDebug
            transport: this.logToDebug.bind(this),
        };
        this.tracerLogger = Tracer.colorConsole(tracerConfig);
        // setup debug
        this.debugLogger = DebugLogger(this.loggerName);
        /*
        // setup LogEntries
        const LOGENTRIES_CONFIG = this._CONFIG_LOGGER.logEntries || {};
        // set log levels
        LOGENTRIES_CONFIG.levels = this._LEVELS;
        this._leNode = new LE(LOGENTRIES_CONFIG);
        */
        // overriding class with tracer API
        return this.tracerLogger;
    }
    /**
     * Empty functions for code completion
     * implementation is within tracer
     */
    trace(...args) {
        // no function
    }
    debug(...args) {
        // no function
    }
    info(...args) {
        // no function
    }
    warn(...args) {
        // no function
    }
    error(...args) {
        // no function
    }
    /**
     *  PRIVATE METHODS
     */
    logToDebug(pLogObject) {
        // use tracer output to log message to DEBUG
        this.debugLogger[pLogObject.title](pLogObject.output);
        // adjust for log entries
        const logArgs = Object.assign({}, pLogObject.args); // copy
        delete logArgs[0];
        /*
        const logEntry: any = {
          env:       this.envInfo.env,
          timestamp: pLogObject.timestamp,
          module:    this.moduleName,
          path:      pLogObject.path,
          file:      pLogObject.file,
          pos:       `${pLogObject.line}:${pLogObject.pos}`,
          method:    pLogObject.method,
          message:   pLogObject.args[0],
          args:      logArgs,
          stack:     pLogObject.stack,
        };
    
        // log remotely to logentries
        this._leNode[pLogObject.title](logEntry);
        */
    }
}
exports.Logger = Logger;
