// Every user-facing string, keyed by screen (constitution III). Check copy against design/ui/ here.
export const strings = {
  app: {
    name: 'Our Cocon',
  },
  debug: {
    build: (commit: string) => `Build ${commit}`,
  },
} as const;
