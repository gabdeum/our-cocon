// Spec 019 FR-005: a shared recipe's page (/r/<token>) with its Open Graph preview, for link
// previews (iMessage, WhatsApp…) that don't run the app. Runs in nginx (njs); the app then loads
// as usual. Anything unexpected serves the plain app page, which shows the right state itself.
/* global ngx */
import fs from 'fs';

const INDEX = '/usr/share/nginx/html/index.html';
const TOKEN = /^\/r\/([A-Za-z0-9_-]{43})\/?$/;

const escape = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/**
 * The app page with the preview tags in its head. `shared` is the share endpoint's answer, or null
 * when the link isn't shared: then only noindex. Every value is escaped.
 */
function previewHtml(index, shared, supabaseUrl, pageUrl) {
  const tags = ['<meta name="robots" content="noindex">'];
  let html = index;
  if (shared && shared.recipe && typeof shared.recipe.name === 'string') {
    const recipe = shared.recipe;
    const title = recipe.name + ' · Our Cocon';
    tags.push('<meta property="og:type" content="article">');
    tags.push('<meta property="og:site_name" content="Our Cocon">');
    tags.push('<meta property="og:title" content="' + escape(recipe.name) + '">');
    tags.push('<meta property="og:url" content="' + escape(pageUrl) + '">');
    if (recipe.description) tags.push('<meta property="og:description" content="' + escape(recipe.description) + '">');
    const signed = recipe.photo_path && shared.signedPhotos ? shared.signedPhotos[recipe.photo_path] : null;
    if (typeof signed === 'string' && signed.indexOf('/storage/v1/object/sign/') === 0) {
      tags.push('<meta property="og:image" content="' + escape(supabaseUrl.replace(/\/+$/, '') + signed) + '">');
      tags.push('<meta name="twitter:card" content="summary_large_image">');
    }
    html = html.replace(/<title>[^<]*<\/title>/, () => '<title>' + escape(title) + '</title>');
  }
  return html.replace('</head>', () => tags.join('') + '</head>');
}

async function page(r) {
  let index;
  try {
    index = fs.readFileSync(INDEX, 'utf8');
  } catch (e) {
    r.error('shared preview: no index.html: ' + e);
    r.return(500);
    return;
  }
  // Photo links use the public URL; the endpoint is asked inside Docker when it can be
  // (SHARE_ENDPOINT_URL, infra/app/compose.yml), so it isn't counted against this server's IP.
  const base = process.env.SUPABASE_URL || '';
  const endpoint = process.env.SHARE_ENDPOINT_URL || base;
  const match = TOKEN.exec(r.uri);
  let shared = null;
  if (match && endpoint) {
    try {
      const res = await ngx.fetch(endpoint.replace(/\/+$/, '') + '/functions/v1/shared-recipe?token=' + match[1], {
        headers: { apikey: process.env.SUPABASE_ANON_KEY || '', Authorization: 'Bearer ' + (process.env.SUPABASE_ANON_KEY || '') },
      });
      if (res.status === 200) shared = await res.json();
    } catch (e) {
      // njs has no `catch {}`; the reason goes to the log, the page still opens.
      r.warn('shared preview: share endpoint unreachable: ' + e);
      shared = null;
    }
  }
  r.headersOut['Content-Type'] = 'text/html; charset=utf-8';
  r.return(200, previewHtml(index, shared, base, 'https://' + r.headersIn.host + r.uri));
}

export default { page, previewHtml };
