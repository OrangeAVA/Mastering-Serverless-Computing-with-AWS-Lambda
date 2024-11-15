#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { TelemetryApiExtensionStack } from '../lib/extension-stack';

const app = new cdk.App();
new TelemetryApiExtensionStack(app, TelemetryApiExtensionStack.name, {
  extensionName: `telemetry-api-extension`,
  description: 'Telemetry Extension for the API',
});
