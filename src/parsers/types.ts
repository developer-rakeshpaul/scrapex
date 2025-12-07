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
 * GitHub-specific metadata for awesome lists
 */
export interface GitHubMeta {
  repoOwner?: string;
  repoName?: string;
  stars?: number;
  lastUpdated?: string;
}
