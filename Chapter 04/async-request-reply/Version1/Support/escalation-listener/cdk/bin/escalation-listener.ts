#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { EscalationListenerStack } from '../lib/escalation-listener-stack';

const app = new cdk.App();
new EscalationListenerStack(app, 'EscalationListenerStack', {});