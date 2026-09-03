import 'reflect-metadata'

import { Injectable } from '@nestjs/common'
import { loadConfigInstance } from './factory'

type EnvValueType = 'string' | 'number' | 'boolean' | 'json' | 'enum' | 'env'

type EnvPropertyMetadata = {
  propertyKey: string
  name: string
  valueType: EnvValueType
  required: boolean
  defaultValue?: unknown
  transform?: ( value: unknown ) => unknown
  enumValues?: string[]
}

const ENV_PROPERTIES = Symbol( 'ENV_PROPERTIES' )

export type EnvValueOptions<T> = {
  name?: string
  required?: boolean
  default?: T
  transform?: ( value: T ) => T
}

function registerEnvProperty( target: object, metadata: EnvPropertyMetadata ) {
  const constructor = target.constructor as { [ENV_PROPERTIES]?: EnvPropertyMetadata[] }
  const properties = constructor[ENV_PROPERTIES] ?? []
  constructor[ENV_PROPERTIES] = [ ...properties, metadata ]
}

function resolveOptions<T>( options?: string | EnvValueOptions<T> ) {
  if ( typeof options === 'string' ) {
    return {
      name: options,
      required: true,
      defaultValue: undefined,
      transform: undefined,
    }
  }

  return {
    name: options?.name,
    required: options?.required ?? true,
    defaultValue: options?.default,
    transform: options?.transform as (( value: unknown ) => unknown) | undefined,
  }
}

function normalizeEnumValues( values: readonly string[] | Record<string, string> ) {
  return Array.isArray( values )
    ? [ ...values ]
    : [ ...new Set( Object.values( values ) ) ]
}

function createEnvDecorator<T>(
  valueType: EnvValueType,
  options?: string | EnvValueOptions<T>,
  enumValues?: readonly string[] | Record<string, string>,
): PropertyDecorator {
  return ( target, propertyKey ) => {
    const resolvedOptions = resolveOptions( options )

    registerEnvProperty( target, {
      propertyKey: propertyKey.toString(),
      name: resolvedOptions.name ?? propertyKey.toString(),
      valueType,
      required: resolvedOptions.required,
      defaultValue: resolvedOptions.defaultValue,
      transform: resolvedOptions.transform,
      enumValues: enumValues ? normalizeEnumValues( enumValues ) : undefined,
    } )
  }
}

export function StringValue( options?: string | EnvValueOptions<string> ) {
  return createEnvDecorator( 'string', options )
}

export function NumberValue( options?: string | EnvValueOptions<number> ) {
  return createEnvDecorator( 'number', options )
}

export function BooleanValue( options?: string | EnvValueOptions<boolean> ) {
  return createEnvDecorator( 'boolean', options )
}

export function JsonValue<T>( options?: string | EnvValueOptions<T> ) {
  return createEnvDecorator<T>( 'json', options )
}

export function EnumValue<T extends string>(
  values: readonly T[] | Record<string, T>,
  options?: string | EnvValueOptions<T>,
) {
  return createEnvDecorator<T>( 'enum', options, values )
}

export function Env() {
  return createEnvDecorator( 'env' )
}

export function getEnvProperties( target: Function ) {
  return ( target as { [ENV_PROPERTIES]?: EnvPropertyMetadata[] } )[ENV_PROPERTIES] ?? []
}

type ClassConstructor<T extends object> = new( ...args: any[] ) => T

function copyMetadata( source: object, target: object ) {
  for ( const metadataKey of Reflect.getMetadataKeys( source ) ) {
    Reflect.defineMetadata( metadataKey, Reflect.getMetadata( metadataKey, source ), target )
  }
}

export function Configurable() {
  return <T extends ClassConstructor<object>>( target: T ) => {
    class ConfigurableClass extends target {
      constructor( ...args: any[] ) {
        super( ...args )
        loadConfigInstance( target, this )
      }
    }

    copyMetadata( target, ConfigurableClass )
    copyMetadata( target.prototype, ConfigurableClass.prototype )
    Injectable()( ConfigurableClass )

    return ConfigurableClass as T
  }
}
