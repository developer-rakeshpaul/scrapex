import { IOptions as SanitizeHtmlOptions } from 'sanitize-html';

export interface ILink {
  text?: string;
  href?: string;
}

export interface IMetadata {
  url: string;
  date?: string;
  image?: string;
  publisher?: string;
  title?: string;
  author?: string;
  description?: string;
  audio?: string;
  logo?: string;
  lang?: string;
  text?: string | null;
  favicon?: string;
  tags: Array<string>;
  keywords: Array<string>;
  links?: ILink[];
  content?: string;
  html?: string;
  source: string;
  video?: string;
  code?: string[];
  embeds?: Array<Record<string, string | undefined>>;
  twitter: Record<string, string | undefined>;
}

type MetaScraperRules =
  | 'audio'
  | 'amazon'
  | 'iframe'
  | 'media-provider'
  | 'soundcloud'
  | 'uol'
  | 'spotify'
  | 'video'
  | 'youtube';

type PageMetaData = {
  description: string;
  icon: string;
  image: string;
  keywords: Array<string>;
  title: string;
  language: string;
  type: string;
  url: string;
  provider: string;
};

export type ScrapeOptions = {
  timeout?: number;
  metascraperRules?: Array<MetaScraperRules>;
  sanitizeOptions?: SanitizeHtmlOptions;
};
