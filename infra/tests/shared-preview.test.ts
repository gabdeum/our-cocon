import { describe, expect, it } from 'vitest';
import preview from '../web/shared-preview.js';

// Spec 019 FR-005: the shared page's Open Graph preview and noindex, built in nginx.
const index = '<html><head><title>Our Cocon</title></head><body></body></html>';
const page = 'https://app.ourcocon.com/r/abc';
const shared = (recipe: Record<string, unknown>, signedPhotos: Record<string, string> = {}) => ({ recipe, signedPhotos });

describe('previewHtml', () => {
  it('adds the photo, name and description (FR-005)', () => {
    const html = preview.previewHtml(
      index,
      shared({ name: 'Leek & bacon quiche', description: 'Silky custard.', photo_path: 'p.jpg' }, { 'p.jpg': '/storage/v1/object/sign/recipe-photos/p.jpg?token=t' }),
      'https://api.ourcocon.com/',
      page,
    );
    expect(html).toContain('<meta property="og:title" content="Leek &amp; bacon quiche">');
    expect(html).toContain('<meta property="og:description" content="Silky custard.">');
    expect(html).toContain('<meta property="og:image" content="https://api.ourcocon.com/storage/v1/object/sign/recipe-photos/p.jpg?token=t">');
    expect(html).toContain('<title>Leek &amp; bacon quiche · Our Cocon</title>');
  });

  it('is always noindex, even when the link is not shared', () => {
    const html = preview.previewHtml(index, null, 'https://api.ourcocon.com', page);
    expect(html).toContain('<meta name="robots" content="noindex">');
    expect(html).not.toContain('og:');
    expect(html).toContain('<title>Our Cocon</title>');
  });

  it('escapes whatever the recipe says, so it stays text', () => {
    const html = preview.previewHtml(index, shared({ name: '"><script>alert(1)</script>', description: "Mia's $& pie" }), 'https://api', page);
    expect(html).not.toContain('<script>');
    expect(html).toContain('content="&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;"');
    expect(html).toContain('content="Mia&#39;s $&amp; pie"');
  });

  it('leaves out a photo link that is not a signed storage link', () => {
    const html = preview.previewHtml(index, shared({ name: 'Q', photo_path: 'p.jpg' }, { 'p.jpg': 'https://evil.example/x.jpg' }), 'https://api', page);
    expect(html).not.toContain('og:image');
  });
});
