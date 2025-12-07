import { DEFAULT_USER_AGENT } from './types.js';

/**
 * Result of robots.txt check
 */
export interface RobotsCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Parsed robots.txt rules
 */
interface RobotsRules {
  disallow: string[];
  allow: string[];
}

/**
 * Check if URL is allowed by robots.txt
 *
 * @param url - The URL to check
 * @param userAgent - User agent to check rules for
 * @returns Whether the URL is allowed and optional reason
 */
export async function checkRobotsTxt(
  url: string,
  userAgent: string = DEFAULT_USER_AGENT
): Promise<RobotsCheckResult> {
  try {
    const parsedUrl = new URL(url);
    const robotsUrl = `${parsedUrl.protocol}//${parsedUrl.host}/robots.txt`;

    // Fetch robots.txt with short timeout
    const response = await fetch(robotsUrl, {
      headers: { 'User-Agent': userAgent },
      signal: AbortSignal.timeout(5000),
    });

    // No robots.txt = allowed
    if (!response.ok) {
      return { allowed: true };
    }

    const robotsTxt = await response.text();
    const rules = parseRobotsTxt(robotsTxt, userAgent);

    const path = parsedUrl.pathname + parsedUrl.search;
    const allowed = isPathAllowed(rules, path);

    return {
      allowed,
      reason: allowed ? undefined : 'Blocked by robots.txt',
    };
  } catch {
    // On error (timeout, network issue), assume allowed
    return { allowed: true };
  }
}

/**
 * Parse robots.txt content for a specific user agent
 */
function parseRobotsTxt(content: string, userAgent: string): RobotsRules {
  const rules: RobotsRules = { disallow: [], allow: [] };
  const lines = content.split('\n');

  // Extract the bot name from user agent (first word or before /)
  const botName = userAgent.split(/[\s/]/)[0]?.toLowerCase() || '';

  let currentAgent = '';
  let isMatchingAgent = false;
  let hasFoundSpecificAgent = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Skip empty lines and comments
    if (!line || line.startsWith('#')) {
      continue;
    }

    // Parse directive
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const directive = line.slice(0, colonIndex).trim().toLowerCase();
    const value = line.slice(colonIndex + 1).trim();

    if (directive === 'user-agent') {
      currentAgent = value.toLowerCase();
      // Check if this agent applies to us
      isMatchingAgent =
        currentAgent === '*' || currentAgent === botName || botName.includes(currentAgent);

      // Prefer specific agent rules over wildcard
      if (currentAgent !== '*' && isMatchingAgent) {
        hasFoundSpecificAgent = true;
        // Reset rules if we found a more specific match
        rules.disallow = [];
        rules.allow = [];
      }
    } else if (isMatchingAgent && (!hasFoundSpecificAgent || currentAgent !== '*')) {
      if (directive === 'disallow' && value) {
        rules.disallow.push(value);
      } else if (directive === 'allow' && value) {
        rules.allow.push(value);
      }
    }
  }

  return rules;
}

/**
 * Check if a path is allowed based on robots.txt rules
 */
function isPathAllowed(rules: RobotsRules, path: string): boolean {
  // No rules = allowed
  if (rules.disallow.length === 0 && rules.allow.length === 0) {
    return true;
  }

  // Check allow rules first (they take precedence for more specific matches)
  for (const pattern of rules.allow) {
    if (matchesPattern(path, pattern)) {
      return true;
    }
  }

  // Check disallow rules
  for (const pattern of rules.disallow) {
    if (matchesPattern(path, pattern)) {
      return false;
    }
  }

  // Default: allowed
  return true;
}

/**
 * Check if a path matches a robots.txt pattern
 */
function matchesPattern(path: string, pattern: string): boolean {
  // Empty pattern matches nothing
  if (!pattern) return false;

  // Handle wildcard at end
  if (pattern.endsWith('*')) {
    return path.startsWith(pattern.slice(0, -1));
  }

  // Handle $ anchor
  if (pattern.endsWith('$')) {
    return path === pattern.slice(0, -1);
  }

  // Handle wildcards in middle
  if (pattern.includes('*')) {
    const regex = new RegExp(`^${pattern.replace(/\*/g, '.*').replace(/\?/g, '\\?')}.*`);
    return regex.test(path);
  }

  // Simple prefix match
  return path.startsWith(pattern);
}
