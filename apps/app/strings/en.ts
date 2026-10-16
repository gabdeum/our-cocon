// Every user-facing string, keyed by screen (constitution III). Check copy against design/ui/ here.
export const strings = {
  app: {
    name: 'Our Cocon',
  },
  // design/ui/TabBar.md
  tabBar: {
    label: 'Main',
    home: 'Home',
    recipes: 'Recipes',
    groceries: 'Groceries',
    settings: 'Settings',
  },
  debug: {
    build: (commit: string) => `Build ${commit}`,
  },
} as const;
