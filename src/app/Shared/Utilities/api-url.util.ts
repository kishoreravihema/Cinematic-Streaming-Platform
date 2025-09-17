import { environment } from "../../../environments/environment";

function isProxyActive(): boolean {
  // Detect proxy based on dev server port
  return window.location.hostname === 'localhost' && window.location.port === '4200';
}


function getBaseApiUrl(): string {
  if (isProxyActive()) {
    return "/api"; // proxy will map to backend
  }
  return environment.BaseUrl.replace(/\/$/, "") + "/api";
}


/**
 * Builds a full API URL for a given relative path.
 * Example: buildApiUrl('music?page=1') → http://localhost:5008/api/music?page=1
 */
export function buildApiUrl(path: string): string {
  const trimmedPath = path.replace(/^\/+/, ''); // removes leading slashes
  return `${getBaseApiUrl()}/${trimmedPath}`;
}

/**
 * Resolves a stream URL (e.g. video or audio) from a relative path.
 * Example: resolveStreamUrl('Features/video/streamNew/1')
 */
export function resolveStreamUrl(path: string): string {
  return buildApiUrl(path);
}

/**
 * Resolves a thumbnail URL by ID.
 * Example: resolveThumbnailUrl(42) → http://localhost:5008/api/thumbnails/42.jpg
 */
export function resolveThumbnailUrl(id: number): string {
  return buildApiUrl(`thumbnails/${id}.jpg`);
}

/**
 * Resolves a remote URL (e.g. CDN or external asset).
 * If proxy is active, rewrites to `/api/...` for dev server.
 */
export function resolveRemoteUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const cleaned = rawUrl.replace(/^\/+/, '');
  return isProxyActive() ? `/api/${cleaned}` : rawUrl;
}

// function isProxyActive(): boolean {
//   // Detect proxy based on dev server port
//   return window.location.hostname === 'localhost' && window.location.port === '4200';
// }

// function getBaseApiUrl(): string {
//   return isProxyActive() ? '/api' : `${environment.apiBaseUrl.replace(/\/$/, '')}/api`;
// }

// export function buildApiUrl(path: string): string {
//   const trimmedPath = path.startsWith('/') ? path : `/${path}`;
//   return `${getBaseApiUrl()}${trimmedPath}`;
// }

// export function resolveStreamUrl(path: string): string {
//   if (!path || typeof path !== 'string') return '';
//   const trimmedPath = path.replace(/^\//, '');
//   return `${getBaseApiUrl()}/${trimmedPath}`;
// }

// export function resolveThumbnailUrl(id: number): string {
//   const path = `thumbnails/${id}.jpg`;
//   return `${getBaseApiUrl()}/${path}`;
// }
// export function resolveRemoteUrl(rawUrl: string): string {
//   if (!rawUrl || typeof rawUrl !== 'string') return '';
//   const cleaned = rawUrl.replace(/^\//, '');
//   return isProxyActive()
//     ? `/api/${cleaned}`
//     : rawUrl;
// }
// //if we need to use Full url from environment
// export function resolveApiUrl(path: string): string {
//   const trimmed = path.startsWith('/') ? path : `/${path}`;
//   return isProxyActive()
//     ? `/api${trimmed}`
//     : `${environment.apiBaseUrl}/api${trimmed}`;
// }






















// // export function buildApiUrl(path: string): string {
// //   return environment.useProxy ? `/api${path}` : `${environment.apiBaseUrl}/api${path}`;
// // }
// // export function resolveStreamUrl(path: string): string {
// //   if (!path || typeof path !== 'string') return '';
// //   const trimmedPath = path.replace(/^\//, '');
// //   return environment.useProxy
// //     ? `/api/${trimmedPath}`
// //     : `${environment.apiBaseUrl.replace(/\/$/, '')}/api/${trimmedPath}`;
// // }
// // export function resolveThumbnailUrl(id: number): string {
// //   const path = `thumbnails/${id}.jpg`;
// //   return environment.useProxy
// //     ? `/api/${path}`
// //     : `${environment.apiBaseUrl.replace(/\/$/, '')}/api/${path}`;
// // }