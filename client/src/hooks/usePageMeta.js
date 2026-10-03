import { useEffect } from 'react';

export const SITE_URL = 'https://www.socialaidigital.com';
const SITE_NAME = 'SocialAiDigital';
const DEFAULT_TITLE = 'AI Sales Agent for Social Media Comments | SocialAiDigital';
const DEFAULT_DESCRIPTION =
  'Turn Instagram, YouTube and Facebook comments into sales. AI detects buying intent (incl. Hinglish), drafts brand-tone replies and flags complaints.';
const CORE_KEYWORDS = [
  'AI sales agent for social media',
  'social media comment management',
  'Instagram comment automation',
  'YouTube comment management',
  'Facebook comment management',
  'comment to lead',
  'social media lead generation India',
  'Hinglish AI replies',
  'D2C brands',
];

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

/** Per-page title, description, keywords, canonical, social tags and robots directive. */
export default function usePageMeta({
  title,
  fullTitle,
  description,
  keywords,
  path,
  noindex = false,
} = {}) {
  const keywordList = (keywords || []).join(',');
  useEffect(() => {
    const pageTitle = fullTitle || (title ? `${title} | ${SITE_NAME}` : DEFAULT_TITLE);
    const desc = description || DEFAULT_DESCRIPTION;
    const url = `${SITE_URL}${path ?? window.location.pathname}`;
    const pageKeywords = [...(keywordList ? keywordList.split(',') : []), ...CORE_KEYWORDS];

    document.title = pageTitle;
    upsertMeta('name', 'description', desc);
    upsertMeta('name', 'keywords', [...new Set(pageKeywords)].join(', '));
    upsertMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');
    upsertMeta('property', 'og:title', pageTitle);
    upsertMeta('property', 'og:description', desc);
    upsertMeta('property', 'og:url', url);
    upsertMeta('name', 'twitter:title', pageTitle);
    upsertMeta('name', 'twitter:description', desc);
    upsertCanonical(url);
  }, [title, fullTitle, description, keywordList, path, noindex]);
}
