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

type NormalEvent = BaseEvent & {
  type: "normal";
};

type VipEvent = BaseEvent & {
  type: 'vip';
  accumulatedPoints: number;
  endOfValidation: number;
};

type GoldEvent = BaseEvent & {
  type: 'gold';
  body: string;
  accumulatedPoints: number;
};

interface IService {
  process: (command: Command) => Promise<BaseEvent>;
}

interface IEventPublisher {
  publish: (event: BaseEvent) => Promise<void>;
}
let normalService: IService;
let vipService: IService;
let goldService: IService;
let eventPublisher: IEventPublisher;

export const handler = async (event: SQSEvent) => {
  console.log('Received event:', JSON.stringify(event, null, 2));
  for (const record of event.Records) {
    let event: BaseEvent;
    const command = JSON.parse(record.body) as Command;
    switch (command.type) {
      case 'normal':
        event = await normalService.process(command);
        break;
      case 'vip':
        event = await vipService.process(command);
        break;
      case 'gold':
        event = await goldService.process(command);
        break;
      default:
        throw new Error(`Unknown event type: ${command.type}`);
    }

    eventPublisher.publish(event);
    
  }
}