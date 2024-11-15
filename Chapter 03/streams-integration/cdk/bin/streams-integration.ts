#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { StreamIntegrationStack } from '../lib/streams-integration-stack';

const app = new cdk.App();
new StreamIntegrationStack(app, StreamIntegrationStack.name, {});