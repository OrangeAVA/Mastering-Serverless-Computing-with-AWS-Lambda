import { App, Aspects, RemovalPolicy, CfnResource, IAspect } from "aws-cdk-lib";
import { AppStack } from "../lib/app-stack"
import { IConstruct } from 'constructs';

class ApplyDestroyPolicyAspect implements IAspect {
  public visit(node: IConstruct): void {
    if (node instanceof CfnResource) {
      node.applyRemovalPolicy(RemovalPolicy.DESTROY);
    }
  } 
}

const app = new App();
new AppStack(app, AppStack.name, {});

Aspects.of(app).add(new ApplyDestroyPolicyAspect());
