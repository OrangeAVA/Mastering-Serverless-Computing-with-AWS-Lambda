import { APIGatewayProxyEvent, SNSEvent, SNSEventRecord } from "aws-lambda";
import { ListenerService } from "./listener-service";

const listenerService = new ListenerService();
export const handler = async (event: APIGatewayProxyEvent) => {
  const message = JSON.parse(event.body);
  await listenerService.Send(message);  

  return {
    statusCode: 201
  };
}

