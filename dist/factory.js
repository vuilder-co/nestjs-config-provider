"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfigInstance = loadConfigInstance;
exports.createConfigProvider = createConfigProvider;
const dotenv_1 = __importDefault(require("dotenv"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const decorators_1 = require("./decorators");
function findEnvFile(fileName) {
    let currentDir = process.cwd();
    while (true) {
        const candidate = node_path_1.default.join(currentDir, fileName);
        if (node_fs_1.default.existsSync(candidate)) {
            return candidate;
        }
        const parentDir = node_path_1.default.dirname(currentDir);
        if (parentDir === currentDir) {
            return null;
        }
        currentDir = parentDir;
    }
}
function createConfigError(message, context) {
    return new Error(`Failed to load "${context.className}.${context.propertyKey}" from env "${context.envName}" in "${context.envFilePath}": ${message}`);
}
function readEnv(envValues, context, required, defaultValue) {
    const value = process.env[context.envName] ?? envValues[context.envName];
    if (value === undefined) {
        if (defaultValue !== undefined) {
            return defaultValue;
        }
        if (required) {
            throw createConfigError('value is required but was not defined.', context);
        }
    }
    return value;
}
function loadEnvFile(className) {
    const env = (process.env.NODE_ENV ?? 'local').toLowerCase();
    const envFileName = `.env.${env}`;
    const envFilePath = findEnvFile(envFileName);
    if (!envFilePath) {
        throw new Error(`Failed to load "${className}": environment file "${envFileName}" was not found from "${process.cwd()}" upward.`);
    }
    try {
        const envContents = node_fs_1.default.readFileSync(envFilePath);
        return {
            env,
            envFilePath,
            envValues: dotenv_1.default.parse(envContents),
        };
    }
    catch (error) {
        throw new Error(`Failed to load "${className}": unable to read or parse "${envFilePath}".`, { cause: error });
    }
}
function parseEnvNumber(value, context) {
    const parsedValue = Number.parseInt(String(value), 10);
    if (Number.isNaN(parsedValue)) {
        throw createConfigError('value must be a valid number.', context);
    }
    return parsedValue;
}
function parseEnvBoolean(value, context) {
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value !== 'string') {
        throw createConfigError('value must be a valid boolean.', context);
    }
    const normalizedValue = value.toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalizedValue)) {
        return true;
    }
    if (['false', '0', 'no', 'off'].includes(normalizedValue)) {
        return false;
    }
    throw createConfigError('value must be a valid boolean.', context);
}
function parseEnvJson(value, context) {
    if (typeof value !== 'string') {
        return value;
    }
    try {
        return JSON.parse(value);
    }
    catch (error) {
        throw new Error(createConfigError('value must be valid JSON.', context).message, { cause: error });
    }
}
function parseEnvEnum(value, context, enumValues) {
    if (typeof value !== 'string' || !enumValues.includes(value)) {
        throw createConfigError(`value must be one of: ${enumValues.join(', ')}.`, context);
    }
    return value;
}
function applyTransform(value, context, transform) {
    if (!transform) {
        return value;
    }
    try {
        return transform(value);
    }
    catch (error) {
        throw new Error(createConfigError('transform failed.', context).message, { cause: error });
    }
}
function loadConfigInstance(configClass, instance) {
    const className = configClass.name || 'AnonymousConfig';
    const { env, envFilePath, envValues } = loadEnvFile(className);
    const values = Object.fromEntries((0, decorators_1.getEnvProperties)(configClass).map((property) => {
        if (property.valueType === 'env') {
            return [property.propertyKey, env];
        }
        const context = {
            className,
            propertyKey: property.propertyKey,
            envName: property.name,
            envFilePath,
        };
        const rawValue = readEnv(envValues, context, property.required, property.defaultValue);
        if (rawValue === undefined) {
            return [property.propertyKey, undefined];
        }
        if (property.valueType === 'number') {
            return [property.propertyKey, applyTransform(parseEnvNumber(rawValue, context), context, property.transform)];
        }
        if (property.valueType === 'boolean') {
            return [property.propertyKey, applyTransform(parseEnvBoolean(rawValue, context), context, property.transform)];
        }
        if (property.valueType === 'json') {
            return [property.propertyKey, applyTransform(parseEnvJson(rawValue, context), context, property.transform)];
        }
        if (property.valueType === 'enum') {
            return [
                property.propertyKey,
                applyTransform(parseEnvEnum(rawValue, context, property.enumValues ?? []), context, property.transform),
            ];
        }
        return [property.propertyKey, applyTransform(rawValue, context, property.transform)];
    }));
    console.log(`env ${env} loaded from ${envFilePath}`);
    return Object.assign(instance, values);
}
function createConfigProvider(configClass) {
    return {
        provide: configClass,
        useFactory: () => loadConfigInstance(configClass, new configClass()),
    };
}
