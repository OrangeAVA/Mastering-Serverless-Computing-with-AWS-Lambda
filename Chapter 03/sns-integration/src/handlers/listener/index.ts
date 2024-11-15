import { SNSEvent, SNSEventRecord } from "aws-lambda";
import { ListenerService } from "./listener-service";

const listenerService = new ListenerService();
const transformAndSendMessages = async (event: SNSEvent) => {
  
  await Promise.all(event.Records.map(async (record: SNSEventRecord) => {
    const message = JSON.parse(record.Sns.Message);
    await listenerService.Send(message);  
  }));
  
  return {
    statusCode: 201
  };
}

export const handler = transformAndSendMessages;
