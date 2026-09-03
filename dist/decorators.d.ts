import 'reflect-metadata';
type EnvValueType = 'string' | 'number' | 'boolean' | 'json' | 'enum' | 'env';
type EnvPropertyMetadata = {
    propertyKey: string;
    name: string;
    valueType: EnvValueType;
    required: boolean;
    defaultValue?: unknown;
    transform?: (value: unknown) => unknown;
    enumValues?: string[];
};
export type EnvValueOptions<T> = {
    name?: string;
    required?: boolean;
    default?: T;
    transform?: (value: T) => T;
};
export declare function StringValue(options?: string | EnvValueOptions<string>): PropertyDecorator;
export declare function NumberValue(options?: string | EnvValueOptions<number>): PropertyDecorator;
export declare function BooleanValue(options?: string | EnvValueOptions<boolean>): PropertyDecorator;
export declare function JsonValue<T>(options?: string | EnvValueOptions<T>): PropertyDecorator;
export declare function EnumValue<T extends string>(values: readonly T[] | Record<string, T>, options?: string | EnvValueOptions<T>): PropertyDecorator;
export declare function Env(): PropertyDecorator;
export declare function getEnvProperties(target: Function): EnvPropertyMetadata[];
type ClassConstructor<T extends object> = new (...args: any[]) => T;
export declare function Configurable(): <T extends ClassConstructor<object>>(target: T) => T;
export {};
