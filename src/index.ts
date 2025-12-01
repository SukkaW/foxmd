import 'server-only';

import { lazyValue } from 'foxts/lazy-value';
import type { MarkedOptions } from 'marked';
import { Marked } from 'marked';
import { createFoxmdRenderer } from './renderer';
import type { FoxmdRendererOptions } from './renderer';
import { createFoxmdParser } from './parser';

const defaultMarkedInstance = lazyValue<Marked>(() => new Marked());

export interface FoxmdOptions {
  foxmdRendererOptions?: FoxmdRendererOptions,
  markedInstance?: Marked,
  lexerOptions?: MarkedOptions,
  isInline?: boolean
}

export function foxmd(
  markdownString: string,
  {
    foxmdRendererOptions,
    markedInstance = defaultMarkedInstance() as Marked,
    lexerOptions = getDefaultMarkedLexerOptions(markedInstance),
    isInline = false
  }: FoxmdOptions = {}
) {
  const tokens = markedInstance.lexer(markdownString, lexerOptions);

  const parser = createFoxmdParser(createFoxmdRenderer(foxmdRendererOptions));

  return isInline ? parser.parseInline(tokens) : parser.parse(tokens);
}

function getDefaultMarkedLexerOptions(markedInstance: Marked): MarkedOptions {
  return ({
    gfm: true,
    breaks: true,
    tokenizer: markedInstance.defaults.tokenizer
  }) as MarkedOptions;
}
