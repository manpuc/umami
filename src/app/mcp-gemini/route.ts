import { UmamiClient } from '@umami/api-client';
import type { McpLogger } from '@umami/mcp';
import { createUmamiMcpHttpHandler } from '@umami/mcp';
import debug from 'debug';
import { isApiKey, isApiKeyEnabled } from '@/lib/api-key';
import { checkApiKeyAuth, getBearerToken } from '@/lib/auth';
import { uuid } from '@/lib/crypto';
import { getBaseUrl } from '@/lib/get-base-url';
import { createInProcessFetch } from '@/lib/mcp/dispatch';

export const dynamic = 'force-dynamic';

const log = debug('umami:mcp:gemini');

const logger: McpLogger = {
  info: event => log('%j', event),
  error: event => log('%j', event),
};

const handler = createUmamiMcpHttpHandler({
  logger,
  onerror: error => log('handler error: %s', error?.message),
  createClient: (authInfo, ctx) => {
    const baseUrl = getBaseUrl(ctx.requestInfo?.headers).toString().replace(/\/+$/, '');
    const basePath = (process.env.BASE_PATH ?? '').replace(/\/+$/, '');

    return new UmamiClient({
      baseUrl: `${baseUrl}${basePath}/api`,
      token: authInfo.token,
      fetch: createInProcessFetch(),
    });
  },
});

async function resolveToken(request: Request): Promise<string | null> {
  // 1. Check Authorization Bearer header
  const bearerToken = getBearerToken(request);
  if (bearerToken) return bearerToken;

  // 2. Check query parameter `token` or `key` (used by Gemini Web connector)
  try {
    const url = new URL(request.url);
    const queryToken = url.searchParams.get('token') || url.searchParams.get('key');
    if (queryToken) return queryToken;
  } catch {
    // Ignore URL parse error
  }

  // 3. Fallback to server-side env GEMINI_MCP_API_KEY if configured
  if (process.env.GEMINI_MCP_API_KEY) {
    return process.env.GEMINI_MCP_API_KEY;
  }

  return null;
}

async function handle(request: Request) {
  if (process.env.MCP_ENABLED !== '1') {
    return new Response(null, { status: 404 });
  }

  const token = await resolveToken(request);

  if (!token || !isApiKeyEnabled() || !isApiKey(token)) {
    // Return standard 401 without WWW-Authenticate: Bearer header
    // so that Gemini Web connector treats it as a non-OAuth public endpoint
    return Response.json(
      { error: 'invalid_token', error_description: 'Valid Umami API key required via query param (?token=umami_...) or Authorization header.' },
      { status: 401, headers: { 'cache-control': 'no-store' } },
    );
  }

  const auth = await checkApiKeyAuth(request, token);

  if (!auth?.user?.id) {
    return Response.json(
      { error: 'invalid_token', error_description: 'API key not authorized.' },
      { status: 401, headers: { 'cache-control': 'no-store' } },
    );
  }

  const requestId = uuid();
  const authInfo = {
    token,
    clientId: `api-key:${auth.apiKey.id}`,
    scopes: [],
    extra: { userId: auth.user.id, authType: 'api-key', requestId },
  };

  return handler.fetch(request, { authInfo });
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
      'access-control-allow-headers': '*',
      'access-control-max-age': '86400',
    },
  });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}

export async function DELETE(request: Request) {
  return handle(request);
}
