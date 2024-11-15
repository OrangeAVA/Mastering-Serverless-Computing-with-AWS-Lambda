import { CfnResource } from 'aws-cdk-lib';
import { Architecture } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, NodejsFunctionProps, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';

export interface LlrtFunctionProps extends NodejsFunctionProps {
}

export class LlrtFunction extends NodejsFunction {
  constructor(scope: Construct, id: string, props: LlrtFunctionProps) {
    const arch = props.architecture === Architecture.ARM_64 ? 'arm64' : 'x64';
    const binaryUrl = `https://github.com/awslabs/llrt/releases/latest/download/llrt-lambda-${arch}.zip`

    super(scope, id, {
      ...props,
      bundling: {
        target: 'es2020',
        format: OutputFormat.ESM,
        platform: 'neutral',
        minify: false,
        sourcesContent: false,
        mainFields: ['module', 'main'],
        sourceMap: true,
        commandHooks: {
          beforeBundling: () => [],
          afterBundling: (inputDir, outputDir) => [
            `if [ ! -e ${inputDir}/.tmp/${arch}/bootstrap ]; then
              mkdir -p ${inputDir}/.tmp/${arch}
              cd ${inputDir}/.tmp/${arch}
              curl -L -o bootstrap.zip ${binaryUrl}
              unzip bootstrap.zip
              rm -rf bootstrap.zip
             fi`,
            `cp ${inputDir}/.tmp/${arch}/bootstrap ${outputDir}/`,
          ],
          beforeInstall: () => [],
        },
        ...props.bundling,
      },
    });

    (this.node.defaultChild as CfnResource).addPropertyOverride('Runtime', 'provided.al2023');
  }
}
