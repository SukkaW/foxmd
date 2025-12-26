import 'server-only';

import { lazyValue } from 'foxts/lazy-value';
import type { MarkedOptions, MarkedToken } from 'marked';
import { Marked } from 'marked';
import { createFoxmdRenderer } from './renderer';
import type { FoxmdRendererOptions } from './renderer';
import { createFoxmdParser } from './parser';
import type { FoxmdParserOptions } from './parser';
import { tokensToText } from './utils';

export type { FoxmdRendererOptions, FoxmdParserOptions };
export { createFoxmdRenderer, createFoxmdParser };
export type { FoxmdCustomRendererMethods } from './renderer';

const defaultMarkedInstance = lazyValue<Marked>(() => new Marked());

export interface FoxmdOptions {
  foxmdRendererOptions?: FoxmdRendererOptions,
  foxmdParserOptions?: FoxmdParserOptions,
  markedInstance?: Marked,
  lexerOptions?: MarkedOptions,
  isInline?: boolean
}

export function foxmd(
  markdownString: string,
  {
    foxmdRendererOptions,
    foxmdParserOptions,
    markedInstance = defaultMarkedInstance() as Marked,
    lexerOptions = getDefaultMarkedLexerOptions(markedInstance),
    isInline = false
  }: FoxmdOptions = {}
) {
  const tokens = markedInstance.lexer(markdownString, lexerOptions) as MarkedToken[];

  const parser = createFoxmdParser(createFoxmdRenderer(foxmdRendererOptions), foxmdParserOptions);

  return isInline ? parser.parseInline(tokens) : parser.parse(tokens);
}

function getDefaultMarkedLexerOptions(markedInstance: Marked): MarkedOptions {
  return ({
    gfm: true,
    breaks: true,
    tokenizer: markedInstance.defaults.tokenizer
  }) as MarkedOptions;
}

export interface MarkdownToTextOptions {
  markedInstance?: Marked,
  lexerOptions?: MarkedOptions,
  skipCodeBlock?: boolean
}

export function markdownToText(markdownString: string, {
  markedInstance = defaultMarkedInstance() as Marked,
  lexerOptions = getDefaultMarkedLexerOptions(markedInstance),
  skipCodeBlock = false
}: MarkdownToTextOptions = {}): string {
  return tokensToText(markedInstance.lexer(markdownString, lexerOptions) as MarkedToken[], skipCodeBlock);
}
