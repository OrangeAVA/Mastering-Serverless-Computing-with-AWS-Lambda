#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { EventBusStack } from '../lib/event-bus-stack';

const app = new cdk.App();
new EventBusStack(app, 'EventBusStack', {});