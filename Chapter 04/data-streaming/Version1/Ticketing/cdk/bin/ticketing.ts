#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { TicketingStack } from '../lib/ticketing-stack';

const app = new cdk.App();
new TicketingStack(app, TicketingStack.name, {});