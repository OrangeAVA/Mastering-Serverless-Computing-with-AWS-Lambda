import { NestedStack, NestedStackProps, Size } from "aws-cdk-lib";
import { EcsFargateContainerDefinition, EcsJobDefinition, FargateComputeEnvironment, IJobQueue, JobQueue, ManagedComputeEnvironmentBase } from "aws-cdk-lib/aws-batch";
import { IpAddresses, SubnetType, Vpc } from "aws-cdk-lib/aws-ec2";
import { ContainerImage, LogDriver } from "aws-cdk-lib/aws-ecs";
import { Construct } from "constructs";

export class FargateBatchJobStack extends NestedStack {
  readonly JobDefinition: EcsJobDefinition;
  readonly JobQueue: IJobQueue;

  constructor(scope: Construct, id: string, props: NestedStackProps) {
    super(scope, id);

    const vpc = new Vpc(this, "vpc-sfn-integration", {
      ipAddresses: IpAddresses.cidr("10.0.0.0/24"),
      natGateways: 0,
      subnetConfiguration: [
        { name: "public-subnet", subnetType: SubnetType.PUBLIC},
      ],
    });

    const computeEnvironment = new FargateComputeEnvironment(this, 'ComputeEnv', {
      vpc,
      vpcSubnets: { subnetType: SubnetType.PUBLIC },
      maxvCpus: 4,
      
    });
    
    this.JobQueue = new JobQueue(this, 'JobQueue', {
      priority: 1,
      computeEnvironments: [ { computeEnvironment, order: 1 } ],
    });
    
    this.JobDefinition = new EcsJobDefinition(this, 'MyJob', {
      container: new EcsFargateContainerDefinition(this, 'Container', {
        image: ContainerImage.fromAsset("src"),
        memory: Size.mebibytes(512),
        cpu: 0.25,
        logging: LogDriver.awsLogs({ streamPrefix: 'MyJob' }),
        assignPublicIp: true,
      }),
    });
  }
}