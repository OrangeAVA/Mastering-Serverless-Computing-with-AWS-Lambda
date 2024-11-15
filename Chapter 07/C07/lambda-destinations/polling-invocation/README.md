# Useful commands

* `npm run cdk:synth`
* `npm run cdk:deploy`  
* `npm run cdk:destroy` 

## Testing 
The stack has a kinesis feeder lambda that can be triggered using the [`records.json` file](./records.json). simply in the console paste the records.json content as a payload for kinesisFeeder function.
 