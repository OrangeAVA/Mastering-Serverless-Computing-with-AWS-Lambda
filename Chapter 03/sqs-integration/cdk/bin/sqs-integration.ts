#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SqsIntegrationStack } from '../lib/sqs-integration-stack';

const app = new cdk.App();
new SqsIntegrationStack(app, SqsIntegrationStack.name, {});