import { runCli } from './cli/benchmark.cli.js';

process.exitCode = await runCli(process.argv.slice(2));
