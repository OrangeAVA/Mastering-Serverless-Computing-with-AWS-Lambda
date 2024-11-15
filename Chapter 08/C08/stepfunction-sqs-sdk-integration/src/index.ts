import { SQSEvent } from "aws-lambda";
import { SFNClient, SendTaskFailureCommand, SendTaskHeartbeatCommand, SendTaskSuccessCommand } from "@aws-sdk/client-sfn";

type Payload = {
  heartBeat?: number;
}
const client = new SFNClient({ region: process.env.AWS_REGION });
export const handler = async (event: SQSEvent) => {
  const payload = JSON.parse(event.Records[0].body) as Payload;
  const taskToken = event.Records[0].messageAttributes["taskToken"].stringValue;

  let isFinished = false;
  treatEvent(payload).then(() => isFinished = true);
  
  try {
    if( payload?.heartBeat ) {
      let i = 0;
      while (!isFinished) {
        await client.send(new SendTaskHeartbeatCommand({
          taskToken: taskToken,
        }))
        console.log(`Heartbeat sent ${i} for ${taskToken}`);
        await sleep(payload?.heartBeat - 500);
        console.log(`Process ${i++} Slept for ${payload?.heartBeat - 500} ms`);
      }
    }

    await client.send(new SendTaskSuccessCommand({
      taskToken: taskToken,
      output: JSON.stringify({ 
        processResult: 'SomeThing done asynchronously!', 
        messageId: event.Records[0].messageId 
      })
    }))
  } catch (error: any) {
    await client.send(new SendTaskFailureCommand({
      taskToken: taskToken,
      error: error.message,
      cause: error.stack
    }));
  }
};

const treatEvent = async (payload: Payload) => {
  await sleep(60000)
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));