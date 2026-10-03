import { useEffect } from 'react';

export const SITE_URL = 'https://www.socialaidigital.com';
const SITE_NAME = 'SocialAiDigital';
const DEFAULT_TITLE = 'SocialAiDigital — AI Sales Agent for Social Media';
const DEFAULT_DESCRIPTION =
  'SocialAiDigital turns social comments into sales leads, complaint intel, and brand-tone replies.';

function upsertMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonical(href) {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/** Per-page title, description, canonical, social tags and robots directive. */
export default function usePageMeta({ title, description, path, noindex = false } = {}) {
  useEffect(() => {
    const fullTitle = title ? `${title} — ${SITE_NAME}` : DEFAULT_TITLE;
    const desc = description || DEFAULT_DESCRIPTION;
    const url = `${SITE_URL}${path ?? window.location.pathname}`;

    document.title = fullTitle;
    upsertMeta('name', 'description', desc);
    upsertMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');
    upsertMeta('property', 'og:title', fullTitle);
    upsertMeta('property', 'og:description', desc);
    upsertMeta('property', 'og:url', url);
    upsertMeta('name', 'twitter:title', fullTitle);
    upsertMeta('name', 'twitter:description', desc);
    upsertCanonical(url);
  }, [title, description, path, noindex]);
}
