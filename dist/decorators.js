"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StringValue = StringValue;
exports.NumberValue = NumberValue;
exports.BooleanValue = BooleanValue;
exports.JsonValue = JsonValue;
exports.EnumValue = EnumValue;
exports.Env = Env;
exports.getEnvProperties = getEnvProperties;
exports.Configurable = Configurable;
require("reflect-metadata");
const common_1 = require("@nestjs/common");
const factory_1 = require("./factory");
const ENV_PROPERTIES = Symbol('ENV_PROPERTIES');
function registerEnvProperty(target, metadata) {
    const constructor = target.constructor;
    const properties = constructor[ENV_PROPERTIES] ?? [];
    constructor[ENV_PROPERTIES] = [...properties, metadata];
}
function resolveOptions(options) {
    if (typeof options === 'string') {
        return {
            name: options,
            required: true,
            defaultValue: undefined,
            transform: undefined,
        };
    }
    return {
        name: options?.name,
        required: options?.required ?? true,
        defaultValue: options?.default,
        transform: options?.transform,
    };
}
function normalizeEnumValues(values) {
    return Array.isArray(values)
        ? [...values]
        : [...new Set(Object.values(values))];
}
function createEnvDecorator(valueType, options, enumValues) {
    return (target, propertyKey) => {
        const resolvedOptions = resolveOptions(options);
        registerEnvProperty(target, {
            propertyKey: propertyKey.toString(),
            name: resolvedOptions.name ?? propertyKey.toString(),
            valueType,
            required: resolvedOptions.required,
            defaultValue: resolvedOptions.defaultValue,
            transform: resolvedOptions.transform,
            enumValues: enumValues ? normalizeEnumValues(enumValues) : undefined,
        });
    };
}
function StringValue(options) {
    return createEnvDecorator('string', options);
}
function NumberValue(options) {
    return createEnvDecorator('number', options);
}
function BooleanValue(options) {
    return createEnvDecorator('boolean', options);
}
function JsonValue(options) {
    return createEnvDecorator('json', options);
}
function EnumValue(values, options) {
    return createEnvDecorator('enum', options, values);
}
function Env() {
    return createEnvDecorator('env');
}
function getEnvProperties(target) {
    return target[ENV_PROPERTIES] ?? [];
}
function copyMetadata(source, target) {
    for (const metadataKey of Reflect.getMetadataKeys(source)) {
        Reflect.defineMetadata(metadataKey, Reflect.getMetadata(metadataKey, source), target);
    }
}
function Configurable() {
    return (target) => {
        class ConfigurableClass extends target {
            constructor(...args) {
                super(...args);
                (0, factory_1.loadConfigInstance)(target, this);
            }
        }
        copyMetadata(target, ConfigurableClass);
        copyMetadata(target.prototype, ConfigurableClass.prototype);
        (0, common_1.Injectable)()(ConfigurableClass);
        return ConfigurableClass;
    };
}
