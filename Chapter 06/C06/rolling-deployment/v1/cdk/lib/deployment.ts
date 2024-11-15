import { Construct } from 'constructs';
import { Alias } from 'aws-cdk-lib/aws-lambda';
import { ILambdaDeploymentConfig, LambdaApplication, LambdaApplicationProps, LambdaDeploymentConfig, LambdaDeploymentGroup } from 'aws-cdk-lib/aws-codedeploy';
import { Alarm } from 'aws-cdk-lib/aws-cloudwatch';

export interface DeploymentProps extends LambdaApplicationProps {
  deploymentConfig: ILambdaDeploymentConfig;
  alias: Alias;
  alarms?: Alarm[];
}

export class Deployment extends LambdaApplication {
  public readonly deploymentGroup: LambdaDeploymentGroup;

  constructor(scope: Construct, id: string, props: DeploymentProps) {
    super(scope, id, props);

    const failureAlarm = new Alarm(this, "DeploymentAlarm", {
      metric: props.alias.metricErrors(),
      threshold: 1,
      evaluationPeriods: 1,
    });

    const alarms = [failureAlarm].concat(props.alarms ?? []);
    const deploymentConfig = props.deploymentConfig ?? LambdaDeploymentConfig.ALL_AT_ONCE;

    this.deploymentGroup = new LambdaDeploymentGroup(
      this,
      `${id} CodeDeploy Deployment Group`,
      {
        application: this,
        alias: props.alias,
        alarms,
        deploymentConfig
      }
    );
  }
}