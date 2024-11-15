import { build } from 'esbuild';
const handlerPath = "./handlers";
const bundledPath = "./build";

const AllEntries: string[] = [];
AllEntries.push(`${handlerPath}/create-item/index.ts`);

build({
    entryPoints: AllEntries,
    entryNames: '[dir]/[name]',
    outbase:'.',
    bundle: true,
    minify: true,
    sourcemap: false,
    sourcesContent: false,
    outdir: `${bundledPath}`,
    platform: 'node',
    format: 'cjs',
    write: true,
    external: [ '@aws-sdk' ],
}).catch(() => process.exit());