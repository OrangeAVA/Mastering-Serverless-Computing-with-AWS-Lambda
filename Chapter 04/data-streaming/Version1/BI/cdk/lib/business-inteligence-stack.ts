import * as cdk from 'aws-cdk-lib';
import { Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Stream } from 'aws-cdk-lib/aws-kinesis';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { DeliveryStream } from '@aws-cdk/aws-kinesisfirehose-alpha';
import { S3Bucket } from '@aws-cdk/aws-kinesisfirehose-destinations-alpha';

export class BusinessInteligenceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const assignmentDataStreamArn = StringParameter.valueForStringParameter(this, '/assignment/datastream/arn');     
    const assignmentDataStream = Stream.fromStreamArn(this, "AssignmentDataStreamArnParameter", assignmentDataStreamArn);

    const deliveryStreamRole = new Role(this, 'DeliveryStreamRole', {
      assumedBy: new ServicePrincipal('firehose.amazonaws.com'),
    });
    const destinationRole = new Role(this, 'DestinationRole', {
      assumedBy: new ServicePrincipal('firehose.amazonaws.com'),
    });
    const deliveryBucket = new Bucket(this, "DeliveryBucket");
    new DeliveryStream(this, 'BiDeliveryStream', {
      destinations: [new S3Bucket(deliveryBucket, { role: destinationRole })],
      sourceStream: assignmentDataStream,
      role: deliveryStreamRole
    });
    
    assignmentDataStream.grantRead(deliveryStreamRole);
  }
}
