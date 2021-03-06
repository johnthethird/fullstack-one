"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class CreateExpressions {
    constructor(expressions, tableName, total = false) {
        this.expressionsObject = {};
        this.expressionsByName = {};
        this.total = false;
        Object.values(expressions).forEach((expression) => {
            if (this.expressionsByName[expression.name] != null) {
                throw new Error(`Expression '${expression.name}' is defined at least twice.`);
            }
            this.expressionsByName[expression.name] = expression;
        });
        this.tableName = tableName;
        this.total = total;
    }
    getExpressionsObject() {
        return this.expressionsObject;
    }
    parseExpressionInput(expressions) {
        return this.fixExpressionType(expressions).map((expression) => {
            return this.getExpressionObject(expression.name, expression.params || {}, true);
        });
    }
    getExpressionObject(name, params, isRoot) {
        const expressionName = this.getExpression(name, params, isRoot);
        return this.expressionsObject[expressionName];
    }
    // Allow String/Array/Object as input and transfer it to an array of objects
    fixExpressionType(expression) {
        const expressions = [];
        if (Array.isArray(expression) === true) {
            expression.forEach((innerExpression) => {
                this.fixExpressionType(innerExpression).forEach(e => expressions.push(e));
            });
        }
        else if (typeof expression === 'string') {
            expressions.push({ name: expression });
        }
        else if (typeof expression === 'object' && expression.name != null) {
            expressions.push(expression);
        }
        return expressions;
    }
    getExpression(name, params, isRoot = false) {
        if (this.expressionsByName[name] == null) {
            throw new Error(`Expression '${name}' is not defined.`);
        }
        const expression = this.expressionsByName[name];
        let expressionName = name;
        if (params != null && typeof params === 'object' && Object.keys(params).length > 0) {
            if (expression.getNameWithParams == null) {
                throw new Error(`You are using expression '${name}' with params. However, this expression has not defined 'getNameWithParams(params)'.`);
            }
            expressionName = expression.getNameWithParams(params);
        }
        expressionName = `_${expressionName}`;
        if (this.expressionsObject[expressionName] == null) {
            const expressionContext = {
                getField: (fieldName) => {
                    this.expressionsObject[expressionName].requiresLateral = true;
                    return `"${this.tableName}"."${fieldName}"`;
                },
                getExpression: (tempName, tempParams) => {
                    const tempExpressionName = this.getExpression(tempName, tempParams);
                    this.expressionsObject[expressionName].requiresLateral = true;
                    this.expressionsObject[expressionName].order = this.expressionsObject[tempExpressionName].order + 1;
                    if (this.expressionsObject[tempExpressionName].requiresAuth === true) {
                        this.expressionsObject[expressionName].requiresAuth = true;
                    }
                    if (this.expressionsObject[expressionName].dependentExpresssions.indexOf(tempExpressionName) < 0) {
                        this.expressionsObject[expressionName].dependentExpresssions.push(tempExpressionName);
                    }
                    if (this.total === true) {
                        return `(${this.expressionsObject[tempExpressionName].sql})`;
                    }
                    else {
                        return `"${tempExpressionName}"."${tempExpressionName}"`;
                    }
                }
            };
            this.expressionsObject[expressionName] = {
                type: expression.type,
                gqlReturnType: expression.gqlReturnType,
                name: expressionName,
                sql: null,
                requiresLateral: false,
                requiresAuth: expression.requiresAuth === true ? true : false,
                dependentExpresssions: [],
                order: 0,
                isRoot
            };
            this.expressionsObject[expressionName].sql = expression.generate(expressionContext, params);
            if (this.expressionsObject[expressionName].sql.toLowerCase() === 'true' && this.expressionsObject[expressionName].requiresAuth === true) {
                throw new Error(`A expression which requires auth cannot return 'TRUE' as SQL. Look at '${name}'.`);
            }
        }
        return expressionName;
    }
}
exports.CreateExpressions = CreateExpressions;
function orderExpressions(a, b) {
    if (a.order > b.order) {
        return 1;
    }
    if (a.order < b.order) {
        return -1;
    }
    return 0;
}
exports.orderExpressions = orderExpressions;
