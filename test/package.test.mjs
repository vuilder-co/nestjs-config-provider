import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const {
  BooleanValue,
  Configurable,
  EnumValue,
  Env,
  JsonValue,
  NumberValue,
  StringValue,
  createConfigProvider,
  loadConfigInstance,
} = await import( '../dist/index.js' )

function applyDecorator( decorator, target, propertyKey ) {
  decorator( target.prototype, propertyKey )
}

function restoreEnv( snapshot ) {
  for ( const key of Object.keys( process.env ) ) {
    if ( !( key in snapshot ) ) {
      delete process.env[key]
    }
  }

  for ( const [ key, value ] of Object.entries( snapshot ) ) {
    if ( value === undefined ) {
      delete process.env[key]
      continue
    }

    process.env[key] = value
  }
}

function withTempProject( envFileName, envContents, run ) {
  const originalCwd = process.cwd()
  const originalEnv = { ...process.env }
  const originalConsoleLog = console.log
  const tempRoot = fs.mkdtempSync( path.join( os.tmpdir(), 'nestjs-config-provider-' ) )
  const nestedDir = path.join( tempRoot, 'apps', 'api' )

  fs.mkdirSync( nestedDir, { recursive: true } )
  fs.writeFileSync( path.join( tempRoot, envFileName ), envContents )
  process.chdir( nestedDir )
  console.log = () => {}

  try {
    return run()
  }
  finally {
    console.log = originalConsoleLog
    process.chdir( originalCwd )
    restoreEnv( originalEnv )
    fs.rmSync( tempRoot, { recursive: true, force: true } )
  }
}

test( 'loadConfigInstance reads env values, defaults, transforms, and NODE_ENV', () => {
  class AppConfig {}

  applyDecorator( StringValue( 'APP_NAME' ), AppConfig, 'appName' )
  applyDecorator( NumberValue( { name: 'PORT', transform: value => value + 1 } ), AppConfig, 'port' )
  applyDecorator( BooleanValue( 'ENABLE_DOCS' ), AppConfig, 'enableDocs' )
  applyDecorator( JsonValue( 'ALLOWED_ORIGINS' ), AppConfig, 'allowedOrigins' )
  applyDecorator( EnumValue( [ 'local', 'production' ], 'APP_MODE' ), AppConfig, 'appMode' )
  applyDecorator( StringValue( { name: 'OPTIONAL_VALUE', required: false, default: 'fallback' } ), AppConfig, 'optionalValue' )
  applyDecorator( Env(), AppConfig, 'env' )

  const config = withTempProject(
    '.env.production',
    [
      'APP_NAME=file-app',
      'PORT=3000',
      'ENABLE_DOCS=false',
      'ALLOWED_ORIGINS=["https://file.example.com"]',
      'APP_MODE=local',
    ].join( '\n' ),
    () => {
      process.env.NODE_ENV = 'PRODUCTION'
      process.env.APP_NAME = 'process-app'
      process.env.ENABLE_DOCS = 'true'

      return loadConfigInstance( AppConfig, new AppConfig() )
    },
  )

  assert.equal( config.appName, 'process-app' )
  assert.equal( config.port, 3001 )
  assert.equal( config.enableDocs, true )
  assert.deepEqual( config.allowedOrigins, [ 'https://file.example.com' ] )
  assert.equal( config.appMode, 'local' )
  assert.equal( config.optionalValue, 'fallback' )
  assert.equal( config.env, 'production' )
} )

test( 'loadConfigInstance loads .env when NODE_ENV is unset or empty', () => {
  class FallbackConfig {}

  applyDecorator( StringValue( 'APP_NAME' ), FallbackConfig, 'appName' )
  applyDecorator( Env(), FallbackConfig, 'env' )

  // 1) when NODE_ENV is unset (undefined)
  const configWhenUnset = withTempProject(
    '.env',
    'APP_NAME=default-env-app\n',
    () => {
      delete process.env.NODE_ENV
      return loadConfigInstance( FallbackConfig, new FallbackConfig() )
    },
  )

  assert.equal( configWhenUnset.appName, 'default-env-app' )
  assert.equal( configWhenUnset.env, undefined )

  // 2) when NODE_ENV is empty string or whitespace
  const configWhenEmpty = withTempProject(
    '.env',
    'APP_NAME=empty-env-app\n',
    () => {
      process.env.NODE_ENV = '   '
      return loadConfigInstance( FallbackConfig, new FallbackConfig() )
    },
  )

  assert.equal( configWhenEmpty.appName, 'empty-env-app' )
  assert.equal( configWhenEmpty.env, undefined )
} )

test( 'createConfigProvider returns a provider that loads a config instance', () => {
  class ProviderConfig {}

  applyDecorator( StringValue( 'APP_NAME' ), ProviderConfig, 'appName' )
  applyDecorator( NumberValue( 'PORT' ), ProviderConfig, 'port' )

  const provider = withTempProject(
    '.env.local',
    [
      'APP_NAME=provider-app',
      'PORT=4100',
    ].join( '\n' ),
    () => {
      process.env.NODE_ENV = 'local'
      const createdProvider = createConfigProvider( ProviderConfig )

      assert.equal( createdProvider.provide, ProviderConfig )
      assert.equal( typeof createdProvider.useFactory, 'function' )

      return createdProvider
    },
  )

  const instance = withTempProject(
    '.env.local',
    [
      'APP_NAME=provider-app',
      'PORT=4100',
    ].join( '\n' ),
    () => {
      process.env.NODE_ENV = 'local'
      return provider.useFactory()
    },
  )

  assert.equal( instance.appName, 'provider-app' )
  assert.equal( instance.port, 4100 )
} )

test( 'Configurable loads values during class instantiation', () => {
  class BaseConfig {
    constructor() {
      this.created = true
    }
  }

  applyDecorator( StringValue( 'APP_NAME' ), BaseConfig, 'appName' )
  applyDecorator( Env(), BaseConfig, 'env' )

  const ConfigurableClass = Configurable()( BaseConfig )

  const instance = withTempProject(
    '.env',
    'APP_NAME=configurable-app\n',
    () => {
      delete process.env.NODE_ENV
      return new ConfigurableClass()
    },
  )

  assert.equal( instance.created, true )
  assert.equal( instance.appName, 'configurable-app' )
  assert.equal( instance.env, undefined )
} )

test( 'loadConfigInstance throws useful errors for invalid or missing values', () => {
  class InvalidConfig {}
  class MissingConfig {}

  applyDecorator( BooleanValue( 'ENABLE_DOCS' ), InvalidConfig, 'enableDocs' )
  applyDecorator( StringValue( 'APP_NAME' ), MissingConfig, 'appName' )

  withTempProject(
    '.env',
    'ENABLE_DOCS=maybe\n',
    () => {
      delete process.env.NODE_ENV

      return assert.throws(
        () => loadConfigInstance( InvalidConfig, new InvalidConfig() ),
        /Failed to load "InvalidConfig\.enableDocs" from env "ENABLE_DOCS".*value must be a valid boolean\./,
      )
    },
  )

  withTempProject(
    '.env',
    '',
    () => {
      delete process.env.NODE_ENV

      return assert.throws(
        () => loadConfigInstance( MissingConfig, new MissingConfig() ),
        /Failed to load "MissingConfig\.appName" from env "APP_NAME".*value is required but was not defined\./,
      )
    },
  )

} )
