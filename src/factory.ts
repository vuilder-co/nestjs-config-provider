import { Provider } from '@nestjs/common'
import dotenv from 'dotenv'
import fs from 'node:fs'
import path from 'node:path'
import { getEnvProperties } from './decorators'

type ClassConstructor<T extends object> = new() => T
type EnvFileValues = Record<string, string>
type PropertyContext = {
  className: string
  propertyKey: string
  envName: string
  envFilePath: string
}

function findEnvFile( fileName: string ) {
  let currentDir = process.cwd()

  while ( true ) {
    const candidate = path.join( currentDir, fileName )

    if ( fs.existsSync( candidate ) ) {
      return candidate
    }

    const parentDir = path.dirname( currentDir )

    if ( parentDir === currentDir ) {
      return null
    }

    currentDir = parentDir
  }
}

function createConfigError( message: string, context: PropertyContext ) {
  return new Error(
    `Failed to load "${context.className}.${context.propertyKey}" from env "${context.envName}" in "${context.envFilePath}": ${message}`,
  )
}

function readEnv( envValues: EnvFileValues, context: PropertyContext, required: boolean, defaultValue?: unknown ) {
  const value = process.env[context.envName] ?? envValues[context.envName]

  if ( value === undefined ) {
    if ( defaultValue !== undefined ) {
      return defaultValue
    }

    if ( required ) {
      throw createConfigError( 'value is required but was not defined.', context )
    }
  }

  return value
}

function loadEnvFile( className: string ) {
  const rawEnv = process.env.NODE_ENV?.trim()
  const env = rawEnv ? rawEnv.toLowerCase() : undefined
  const envFileName = env ? `.env.${env}` : '.env'
  const envFilePath = findEnvFile( envFileName )

  if ( !envFilePath ) {
    throw new Error( `Failed to load "${className}": environment file "${envFileName}" was not found from "${process.cwd()}" upward.` )
  }

  try {
    const envContents = fs.readFileSync( envFilePath )
    return {
      env,
      envFilePath,
      envValues: dotenv.parse( envContents ),
    }
  }
  catch ( error ) {
    throw new Error(
      `Failed to load "${className}": unable to read or parse "${envFilePath}".`,
      { cause: error },
    )
  }
}

function parseEnvNumber( value: unknown, context: PropertyContext ) {
  const parsedValue = Number.parseInt( String( value ), 10 )

  if ( Number.isNaN( parsedValue ) ) {
    throw createConfigError( 'value must be a valid number.', context )
  }

  return parsedValue
}

function parseEnvBoolean( value: unknown, context: PropertyContext ) {
  if ( typeof value === 'boolean' ) {
    return value
  }

  if ( typeof value !== 'string' ) {
    throw createConfigError( 'value must be a valid boolean.', context )
  }

  const normalizedValue = value.toLowerCase()

  if ( [ 'true', '1', 'yes', 'on' ].includes( normalizedValue ) ) {
    return true
  }

  if ( [ 'false', '0', 'no', 'off' ].includes( normalizedValue ) ) {
    return false
  }

  throw createConfigError( 'value must be a valid boolean.', context )
}

function parseEnvJson( value: unknown, context: PropertyContext ) {
  if ( typeof value !== 'string' ) {
    return value
  }

  try {
    return JSON.parse( value )
  }
  catch ( error ) {
    throw new Error(
      createConfigError( 'value must be valid JSON.', context ).message,
      { cause: error },
    )
  }
}

function parseEnvEnum( value: unknown, context: PropertyContext, enumValues: string[] ) {
  if ( typeof value !== 'string' || !enumValues.includes( value ) ) {
    throw createConfigError( `value must be one of: ${enumValues.join( ', ' )}.`, context )
  }

  return value
}

function applyTransform( value: unknown, context: PropertyContext, transform?: ( value: unknown ) => unknown ) {
  if ( !transform ) {
    return value
  }

  try {
    return transform( value )
  }
  catch ( error ) {
    throw new Error(
      createConfigError( 'transform failed.', context ).message,
      { cause: error },
    )
  }
}

export function loadConfigInstance<T extends object>( configClass: ClassConstructor<T>, instance: T ) {
  const className = configClass.name || 'AnonymousConfig'
  const { env, envFilePath, envValues } = loadEnvFile( className )
  const values = Object.fromEntries(
    getEnvProperties( configClass ).map( ( property ) => {
      if ( property.valueType === 'env' ) {
        return [ property.propertyKey, env ]
      }

      const context: PropertyContext = {
        className,
        propertyKey: property.propertyKey,
        envName: property.name,
        envFilePath,
      }

      const rawValue = readEnv( envValues, context, property.required, property.defaultValue )

      if ( rawValue === undefined ) {
        return [ property.propertyKey, undefined ]
      }

      if ( property.valueType === 'number' ) {
        return [ property.propertyKey, applyTransform( parseEnvNumber( rawValue, context ), context, property.transform ) ]
      }

      if ( property.valueType === 'boolean' ) {
        return [ property.propertyKey, applyTransform( parseEnvBoolean( rawValue, context ), context, property.transform ) ]
      }

      if ( property.valueType === 'json' ) {
        return [ property.propertyKey, applyTransform( parseEnvJson( rawValue, context ), context, property.transform ) ]
      }

      if ( property.valueType === 'enum' ) {
        return [
          property.propertyKey,
          applyTransform( parseEnvEnum( rawValue, context, property.enumValues ?? [] ), context, property.transform ),
        ]
      }

      return [ property.propertyKey, applyTransform( rawValue, context, property.transform ) ]
    } ),
  )

  console.log( env ? `env ${env} loaded from ${envFilePath}` : `env loaded from ${envFilePath}` )

  return Object.assign( instance, values )
}

export function createConfigProvider<T extends object>( configClass: ClassConstructor<T> ): Provider {
  return {
    provide: configClass,
    useFactory: () => loadConfigInstance( configClass, new configClass() ),
  }
}
