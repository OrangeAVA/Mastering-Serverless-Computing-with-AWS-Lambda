import { EventBridgeEvent } from "aws-lambda";
import { ListenerService, Message } from "./listener-service";

const listenerService = new ListenerService();
const transformAndSendMessages = async (event: EventBridgeEvent<'UserCreated24HoursAgo', Message>) => {
  await listenerService.Send(event.detail);  
  
  return {
    statusCode: 201
  };
}

export const handler = transformAndSendMessages;
