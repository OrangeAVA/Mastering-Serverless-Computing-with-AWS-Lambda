import { KinesisStreamEvent, KinesisStreamRecord } from "aws-lambda";
import { LogService } from "./logs-service";

const logService = new LogService();
const transformAndSendLogs = async (event: KinesisStreamEvent) => {
  
  await Promise.all(event.Records.map(async (record: KinesisStreamRecord) => {
    const log = JSON.parse(Buffer.from(record.kinesis.data, 'base64').toString());
    await logService.Send(log);  
  }));
  
  return {
    statusCode: 201
  };
}

export const handler = transformAndSendLogs;
