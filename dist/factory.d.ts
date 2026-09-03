import { Provider } from '@nestjs/common';
type ClassConstructor<T extends object> = new () => T;
export declare function loadConfigInstance<T extends object>(configClass: ClassConstructor<T>, instance: T): T & {
    [k: string]: unknown;
};
export declare function createConfigProvider<T extends object>(configClass: ClassConstructor<T>): Provider;
export {};
