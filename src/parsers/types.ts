/**
 * Generic source parser interface.
 * Parsers transform raw content into structured data with metadata.
 *
 * @template TData - The main data type (e.g., array of links)
 * @template TMeta - Optional metadata type
 */
export interface SourceParser<TData, TMeta = unknown> {
  readonly name: string;

  /**
   * Check if this parser can handle the given content
   */
  canParse(content: string, url?: string): boolean;

  /**
   * Parse the content and extract structured data
   */
  parse(content: string, url?: string): ParserResult<TData, TMeta>;
}

/**
 * Result from a parser
 */
export interface ParserResult<TData, TMeta = unknown> {
  data: TData;
  meta?: TMeta;
}

/**
 * RSS/Atom feed item
 */
export interface FeedItem {
  id: string;                    // guid (RSS) or id (Atom)
  title: string;
  link: string;                  // Resolved absolute URL (fallback to id if URL, else empty)
  description?: string;          // summary/description (plain text)
  content?: string;              // full content if available (plain text)
  author?: string;
  publishedAt?: string;          // ISO 8601 date or undefined (never raw strings)
  rawPublishedAt?: string;       // Original date string for debugging/manual parsing
  updatedAt?: string;            // ISO 8601 date or undefined (Atom)
  categories: string[];          // Filtered, no empty strings
  enclosure?: FeedEnclosure;     // podcast/media support
  customFields?: Record<string, string>; // Extracted custom namespace fields
}

/**
 * Media enclosure (podcasts, videos)
 */
export interface FeedEnclosure {
  url: string;                   // Resolved absolute URL
  type?: string;                 // MIME type
  length?: number;               // bytes
}

/**
 * Parsed feed structure
 */
export interface ParsedFeed {
  format: 'rss2' | 'rss1' | 'atom';
  title: string;
  description?: string;
  link: string;                  // Resolved absolute URL
  next?: string;                 // Pagination link (RFC 5005 / Atom rel="next")
  language?: string;
  lastBuildDate?: string;        // ISO 8601 date or undefined
  copyright?: string;            // Channel copyright/rights
  items: FeedItem[];
  customFields?: Record<string, string>; // Extracted custom namespace fields
}

/**
 * Feed metadata
 */
export interface FeedMeta {
  generator?: string;
  ttl?: number;                  // refresh interval in minutes
  image?: {
    url: string;                 // Resolved absolute URL
    title?: string;
    link?: string;
  };
  categories?: string[];
}

/**
 * Markdown link extracted from content
 */
export interface MarkdownLink {
  url: string;
  text: string;
  title?: string;
  context?: string; // Surrounding text/heading
}

/**
 * Markdown section (heading + content)
 */
export interface MarkdownSection {
  level: number;
  title: string;
  content: string;
  links: MarkdownLink[];
}

/**
 * Parsed markdown structure
 */
export interface ParsedMarkdown {
  title?: string;
  description?: string;
  sections: MarkdownSection[];
  links: MarkdownLink[];
  codeBlocks: CodeBlock[];
  frontmatter?: Record<string, unknown>;
}

/**
 * Code block from markdown
 */
export interface CodeBlock {
  language?: string;
  code: string;
  meta?: string;
}

/**
 * GitHub repository metadata
 */
export interface GitHubMeta {
  repoOwner?: string;
  repoName?: string;
  stars?: number;
  lastUpdated?: string;
}
