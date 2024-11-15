#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SupportAssignmentStack } from '../lib/support-assignment-stack';

const app = new cdk.App();
new SupportAssignmentStack(app, 'SupportAssignmentStack', {});