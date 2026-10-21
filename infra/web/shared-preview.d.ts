// Types for shared-preview.js (plain JavaScript, as nginx runs it), for its tests.
declare const preview: {
  page: (r: unknown) => Promise<void>;
  previewHtml: (index: string, shared: unknown, supabaseUrl: string, pageUrl: string) => string;
};
export default preview;
