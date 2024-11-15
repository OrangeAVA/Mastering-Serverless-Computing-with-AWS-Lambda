#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { PollingInvocationStack } from '../lib/polling-invocation-stack';
import { IConstruct } from 'constructs';


class ApplyDestroyPolicyAspect implements cdk.IAspect {
  public visit(node: IConstruct): void {
    if (node instanceof cdk.CfnResource) {
      node.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);
    }
  } 
}

const app = new cdk.App();
new PollingInvocationStack(app, PollingInvocationStack.name, {});

cdk.Aspects.of(app).add(new ApplyDestroyPolicyAspect());

