/**
 * Very small User-Agent classifier for the visitor statistics. Not a full parser: it only
 * needs to separate phones / tablets / desktops / bots and name the common browsers.
 */
export type DeviceKind = 'mobile' | 'tablet' | 'desktop' | 'bot' | 'unknown';

export interface UserAgentInfo {
  device: DeviceKind;
  browser: string;
}

export function describeUserAgent(userAgent: string | null | undefined): UserAgentInfo {
  const ua = (userAgent ?? '').trim();
  if (!ua) return { device: 'unknown', browser: 'Неизвестно' };
  if (/bot|crawl|spider|slurp|headless|monitor|curl|wget/i.test(ua)) return { device: 'bot', browser: 'Бот' };

  let device: DeviceKind = 'desktop';
  if (/iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) device = 'tablet';
  else if (/Mobi|iPhone|iPod|Android/i.test(ua)) device = 'mobile';

  let browser = 'Другой';
  if (/Edg(e|A|iOS)?\//.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/.test(ua)) browser = 'Opera';
  else if (/YaBrowser/.test(ua)) browser = 'Яндекс Браузер';
  else if (/SamsungBrowser/.test(ua)) browser = 'Samsung Internet';
  else if (/Firefox|FxiOS/.test(ua)) browser = 'Firefox';
  else if (/Chrome|CriOS/.test(ua)) browser = 'Chrome';
  else if (/Safari/.test(ua)) browser = 'Safari';

  return { device, browser };
}
