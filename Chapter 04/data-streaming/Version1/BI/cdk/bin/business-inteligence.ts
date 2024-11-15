#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BusinessInteligenceStack } from '../lib/business-inteligence-stack';

const app = new cdk.App();
new BusinessInteligenceStack(app, BusinessInteligenceStack.name, {});