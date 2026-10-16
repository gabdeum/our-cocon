// Test stand-in for NativeWind's runtime: Vitest doesn't run NativeWind (classes aren't turned into
// styles there), so `vars()` just passes the CSS variables through as a style object.
export const vars = (variables: Record<string, string>) => variables;
