const POST_LOGIN_REDIRECT_KEY = 'faelp_post_login_redirect';
const DEFAULT_POST_LOGIN_PATH = '/my-requests';

function isValidPostLoginPath(path: string | null): path is string {
  if (!path) {
    return false;
  }

  // Allow only app-internal absolute paths.
  if (!path.startsWith('/') || path.startsWith('//')) {
    return false;
  }

  if (path.startsWith('/login') || path.startsWith('/callback')) {
    return false;
  }

  return true;
}

export function rememberPostLoginRedirect(path: string) {
  if (!isValidPostLoginPath(path)) {
    return;
  }

  localStorage.setItem(POST_LOGIN_REDIRECT_KEY, path);
}

export function rememberCurrentPathForLogin() {
  rememberPostLoginRedirect(
    `${window.location.pathname}${window.location.search}${window.location.hash}`,
  );
}

export function consumePostLoginRedirect(): string {
  const redirectFromQuery = new URLSearchParams(window.location.search).get('redirect');
  if (isValidPostLoginPath(redirectFromQuery)) {
    return redirectFromQuery;
  }

  const storedRedirect = localStorage.getItem(POST_LOGIN_REDIRECT_KEY);
  localStorage.removeItem(POST_LOGIN_REDIRECT_KEY);

  if (isValidPostLoginPath(storedRedirect)) {
    return storedRedirect;
  }

  return DEFAULT_POST_LOGIN_PATH;
}
