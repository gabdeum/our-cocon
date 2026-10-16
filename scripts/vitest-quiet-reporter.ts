import type { Reporter, TestModule } from 'vitest/node';

/** Prints nothing when every test passes; otherwise each failure with its error, then a count. */
export default class QuietReporter implements Reporter {
  onTestRunEnd(testModules: ReadonlyArray<TestModule>, unhandledErrors: ReadonlyArray<unknown>) {
    const lines: string[] = [];
    let failed = 0;

    for (const mod of testModules) {
      for (const error of mod.errors()) {
        failed++;
        lines.push(`FAIL ${mod.moduleId}`, `  ${error.message}`);
      }
      for (const test of mod.children.allTests('failed')) {
        failed++;
        lines.push(`FAIL ${mod.moduleId} > ${test.fullName}`);
        for (const error of test.result().errors ?? []) {
          lines.push(`  ${error.message}`);
          if (error.diff) lines.push(error.diff.replace(/^/gm, '    '));
          const frame = error.stacks?.[0];
          if (frame) lines.push(`  at ${frame.file}:${frame.line}:${frame.column}`);
        }
      }
    }
    for (const error of unhandledErrors) {
      failed++;
      lines.push(`ERROR ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
    }

    if (failed > 0) {
      process.stdout.write(`${lines.join('\n')}\n\n${failed} failed\n`);
    }
  }
}
