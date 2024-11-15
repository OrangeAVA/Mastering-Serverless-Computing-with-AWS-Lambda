import { SQSEvent } from 'aws-lambda';

type Command = {
  id: string;
  type: string;
  timestamp: number;
  details: any;
};
type EventType = 'normal' | 'vip' | 'gold';
type BaseEvent = {
  id: string;
  type: EventType;
  timestamp: number;
  promotRate: number;
};

interface IService {
  getState: (command: Command) => Promise<BaseEvent>;
}

interface IEventPublisher {
  topicName: string;
  publish: (event: BaseEvent) => Promise<void>;
}
let stateService: IService;
let eventPublisher: IEventPublisher;

export const handler = async (event: SQSEvent) => {
  console.log('Received event:', JSON.stringify(event, null, 2));
  for (const record of event.Records) {
    let event: BaseEvent;
    const command = JSON.parse(record.body) as Command;
    event = await stateService.getState(command);
    if (event.type === 'normal')
      eventPublisher.topicName = 'normal-topic';
    else if (event.type === 'vip')
      eventPublisher.topicName = 'vip-topic';
    else if (event.type === 'gold')
      eventPublisher.topicName = 'gold-topic';
    else
      throw new Error('Invalid event type');

    await eventPublisher.publish(event);
    
  }
}