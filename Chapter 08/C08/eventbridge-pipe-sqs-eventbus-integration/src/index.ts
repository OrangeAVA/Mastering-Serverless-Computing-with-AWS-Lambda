import { SQSRecord } from 'aws-lambda';

type Payload = {
  id: string;
  name: string;
}

const treatRecord = async (payload: Payload) => { 
  console.log(payload);
  return {
    id: payload.id,
    name: payload.name,
  }
} 
export const handler = async (event: SQSRecord[]) => {
  return event.map((record) => {
    const payload = JSON.parse(record.body) as Payload;
    const result = treatRecord(payload);
    if( result ) { return result; }
  })
};