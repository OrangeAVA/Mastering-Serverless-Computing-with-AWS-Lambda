import { EventBridgeEvent } from "aws-lambda";

export const handler = async (event: EventBridgeEvent<any,any>): Promise<any> => {
    console.log(JSON.stringify(event));
    return event;
};