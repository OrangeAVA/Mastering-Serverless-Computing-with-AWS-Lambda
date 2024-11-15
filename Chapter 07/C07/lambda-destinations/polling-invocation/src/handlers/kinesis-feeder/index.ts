import { KinesisClient, PutRecordsCommand } from '@aws-sdk/client-kinesis';

const kinesisClient = new KinesisClient({ region: process.env.AWS_REGION });
export const handler = async (event: any) => {
  console.log(JSON.stringify(event, null, 2));

  await kinesisClient.send(new PutRecordsCommand({
    Records: event.map((record: any) => ({
      Data: Buffer.from(JSON.stringify(record), 'base64'),
      PartitionKey: record.ref
    })),
    StreamARN: process.env.STREAM_ARN
  }))


}
