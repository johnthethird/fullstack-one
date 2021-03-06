"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function getEnumValue(value) {
    return {
        kind: 'EnumValueDefinition',
        name: {
            kind: 'Name',
            value
        },
        directives: []
    };
}
function getEnumDefinition(name, values) {
    return {
        kind: 'EnumTypeDefinition',
        name: {
            kind: 'Name',
            value: name
        },
        directives: [],
        values: values.map(getEnumValue)
    };
}
function getEnum(name, values) {
    return getEnumDefinition(name, values);
}
exports.getEnum = getEnum;
