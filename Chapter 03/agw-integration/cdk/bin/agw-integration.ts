#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AgwIntegrationStack } from '../lib/agw-integration-stack';

const app = new cdk.App();
new AgwIntegrationStack(app, AgwIntegrationStack.name, {});