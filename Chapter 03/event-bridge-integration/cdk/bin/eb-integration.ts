#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { EventBridgeIntegrationStack } from '../lib/eb-integration-stack';

const app = new cdk.App();
new EventBridgeIntegrationStack(app, EventBridgeIntegrationStack.name, {});