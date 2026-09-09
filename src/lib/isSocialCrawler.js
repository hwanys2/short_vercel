/**
 * Social scrapers that need HTML with og:* tags (not 302 redirects).
 * Search engines (Googlebot etc.) are intentionally excluded so they follow redirects.
 */
const SOCIAL_CRAWLER_RE =
  /facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|Discordbot|TelegramBot|WhatsApp|KakaoTalk|kakaotalk-scrap|Line\/|Pinterest|redditbot|SkypeUriPreview|Slack-ImgProxy|Embedly|Quora Link Preview|BitlyBot|Iframely|vkShare|W3C_Validator|MetaInspector|Snapchat|Viber|NaverBot|yeti/i;

export function isSocialCrawler(userAgent) {
  if (!userAgent || typeof userAgent !== 'string') return false;
  return SOCIAL_CRAWLER_RE.test(userAgent);
}
