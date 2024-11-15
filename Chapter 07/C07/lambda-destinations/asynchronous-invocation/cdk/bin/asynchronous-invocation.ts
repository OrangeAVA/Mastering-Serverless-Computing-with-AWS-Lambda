#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AsynchronousInvocationStack } from '../lib/asynchronous-invocation-stack';
import { IConstruct } from 'constructs';


class ApplyDestroyPolicyAspect implements cdk.IAspect {
  public visit(node: IConstruct): void {
    if (node instanceof cdk.CfnResource) {
      node.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);
    }
  } 
}

const app = new cdk.App();
new AsynchronousInvocationStack(app, AsynchronousInvocationStack.name, {});

cdk.Aspects.of(app).add(new ApplyDestroyPolicyAspect());

