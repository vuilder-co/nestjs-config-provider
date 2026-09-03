# @vuilder/nestjs-config-provider

Typed environment configuration for NestJS using decorators.

This package lets you define a config class, annotate each property with a decorator, and load values from `.env.<NODE_ENV>` into a Nest provider.

## Features

- Property decorators for `string`, `number`, `boolean`, `json`, `enum`, and current environment name
- Required/optional values with defaults
- Custom transform functions per property
- Two integration styles:
  - `createConfigProvider()` for explicit provider registration
  - `@Configurable()` for auto-loading on class construction
- Type declarations included for package consumers

## Installation

```bash
pnpm add @vuilder/nestjs-config-provider
```

If your project does not already load it, make sure decorator metadata is enabled in TypeScript:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

## How It Works

At runtime, the package reads `NODE_ENV` and looks for a file named `.env.<node_env>` starting from `process.cwd()` and walking upward until it finds one.

Examples:

- `NODE_ENV=local` -> `.env.local`
- `NODE_ENV=development` -> `.env.development`
- `NODE_ENV=production` -> `.env.production`

If `NODE_ENV` is not set, it defaults to `local`.

When reading a value, `process.env` takes precedence over the value from the `.env.<NODE_ENV>` file.

## Example

`.env.local`

```dotenv
APP_NAME=demo-app
PORT=3000
ENABLE_DOCS=true
ALLOWED_ORIGINS=["http://localhost:3000"]
APP_MODE=local
```

`app.config.ts`

```ts
import {
  BooleanValue,
  Configurable,
  EnumValue,
  Env,
  JsonValue,
  NumberValue,
  StringValue,
} from '@vuilder/nestjs-config-provider'

@Configurable()
export class AppConfig {
  @StringValue()
  appName!: string

  @NumberValue()
  port!: number

  @BooleanValue({ default: false })
  enableDocs!: boolean

  @JsonValue<string[]>({ default: [] })
  allowedOrigins!: string[]

  @EnumValue([ 'local', 'development', 'production' ] as const)
  appMode!: 'local' | 'development' | 'production'

  @Env()
  env!: string
}
```

Then inject it like any other Nest provider:

```ts
import { Module } from '@nestjs/common'
import { AppConfig } from './app.config'

@Module({
  providers: [ AppConfig ],
  exports: [ AppConfig ],
})
export class AppModule {}
```

## Explicit Provider Style

If you do not want to use `@Configurable()`, register a provider directly:

```ts
import { Module } from '@nestjs/common'
import { createConfigProvider } from '@vuilder/nestjs-config-provider'

export class AppConfig {
  @StringValue()
  appName!: string
}

@Module({
  providers: [ createConfigProvider( AppConfig ) ],
  exports: [ AppConfig ],
})
export class AppModule {}
```

## Decorators

### `StringValue(options?)`

Reads a string value without conversion.

### `NumberValue(options?)`

Parses the value with base-10 integer conversion.

### `BooleanValue(options?)`

Accepts:

- `true`, `1`, `yes`, `on`
- `false`, `0`, `no`, `off`

### `JsonValue<T>(options?)`

Parses the value with `JSON.parse`.

### `EnumValue(values, options?)`

Ensures the value matches one of the provided enum values.

### `Env()`

Stores the resolved environment name from `NODE_ENV` or `local`.

## Options

All value decorators support either a string env name:

```ts
@StringValue('APP_NAME')
appName!: string
```

Or an options object:

```ts
@NumberValue({
  name: 'PORT',
  required: false,
  default: 3000,
  transform: value => value + 1,
})
port!: number
```

Available options:

- `name`: environment variable name. Defaults to the property name.
- `required`: defaults to `true`.
- `default`: fallback value when nothing is defined.
- `transform`: custom function applied after parsing.

## Error Behavior

The package throws when:

- the `.env.<NODE_ENV>` file cannot be found
- a required value is missing
- a `number`, `boolean`, `json`, or `enum` value cannot be parsed or validated
- a custom `transform` function throws

Error messages include the class name, property name, env name, and env file path.

## Exports

```ts
import {
  BooleanValue,
  Configurable,
  EnumValue,
  Env,
  JsonValue,
  NumberValue,
  StringValue,
  createConfigProvider,
  loadConfigInstance,
} from '@vuilder/nestjs-config-provider'
```

## Notes

- `@Configurable()` applies Nest's `@Injectable()` internally.
- The package imports `reflect-metadata` internally.
- `NumberValue()` currently uses integer parsing, not floating-point parsing.
- The loader prints the resolved env file path with `console.log`.

## Build

```bash
pnpm run build
```
