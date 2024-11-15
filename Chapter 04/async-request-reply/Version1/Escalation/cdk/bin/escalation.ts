#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { EscalationStack } from '../lib/escalation-stack';

const stackNumber = process.argv[2] ?? 0;
const app = new cdk.App();
new EscalationStack(app, `${EscalationStack.name}-${stackNumber}`, {});