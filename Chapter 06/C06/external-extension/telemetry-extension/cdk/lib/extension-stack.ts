import * as cdk from 'aws-cdk-lib';
import { Code, LayerVersion } from 'aws-cdk-lib/aws-lambda';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import path = require('path');

export interface TelemetryApiExtensionStackProps extends cdk.StackProps {
  extensionName: string,
  description?: string
}

export class TelemetryApiExtensionStack extends cdk.Stack {

  constructor(scope: Construct, id: string, props: TelemetryApiExtensionStackProps) {
    super(scope, id, props);

    const extension = new LayerVersion(this, 'telemetry-api-extension', {
      layerVersionName: `${props?.extensionName}`,
      code: Code.fromAsset(path.resolve(`../src/build`)),
      compatibleArchitectures: [
        cdk.aws_lambda.Architecture.X86_64,
        cdk.aws_lambda.Architecture.ARM_64
      ],
      compatibleRuntimes: [
        cdk.aws_lambda.Runtime.NODEJS_20_X
      ],
      description: props?.extensionName
    });

    new StringParameter(this, `telemetry-api-extension-param`, {
      parameterName: `/telemetry/extension/arn`,
      stringValue: extension.layerVersionArn,
    });
  }
}
