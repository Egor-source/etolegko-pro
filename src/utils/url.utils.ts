export function parseHttpUrl(value: string): URL {
  const url = URL.parse(value);
  if (!url) {
    throw new Error('Invalid URL. Provide an absolute HTTP or HTTPS URL.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(
      `Unsupported protocol (${url.protocol}). Use HTTP or HTTPS.`,
    );
  }
  if (url.username || url.password) {
    throw new Error('Credentials embedded in the URL are unsupported.');
  }
  return url;
}
