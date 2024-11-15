# Telemetry Api Extension

The example provides a simple way of understanding how to use the lambda external extensions, the example uses the lambda telemetry api to receive the log records and has no final process of persisting results.

## Build

To build the extension code run the following command

```shell
 > cd src && npm i && npm run build:extension
```

the build process will provide the build assets in `src/build` path.

## Deploy

To deploy the Extension run the following command, consider building the extension before deploy step.

```shell
> cd cdk && npm i && npm run cdk:dev deploy
```


