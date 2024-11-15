#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SnsIntegrationStack } from '../lib/sns-integration-stack';

const app = new cdk.App();
new SnsIntegrationStack(app, SnsIntegrationStack.name, {});