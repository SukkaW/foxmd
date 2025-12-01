import 'server-only';

import { lazyValue } from 'foxts/lazy-value';
import type { MarkedOptions } from 'marked';
import { Marked } from 'marked';
import { createFoxmdRenderer } from './renderer';
import type { FoxmdRendererOptions } from './renderer';
import { createFoxmdParser } from './parser';

const defaultMarkedInstance = lazyValue<Marked<string, unknown>>(() => new Marked());

export function foxmd(
  markdownString: string,
  markedInstance: Marked<string, unknown> = defaultMarkedInstance() as Marked<string, unknown>,
  lexerOptions?: MarkedOptions<string, unknown>,
  foxmdRendererOptions?: FoxmdRendererOptions,
  isInline = false
): React.ReactNode[] {
  const tokens = markedInstance.lexer(
    markdownString,
    lexerOptions ?? getDefaultMarkedLexerOptions(markedInstance)
  );

  const parser = createFoxmdParser(createFoxmdRenderer(foxmdRendererOptions));

  return isInline ? parser.parseInline(tokens) : parser.parse(tokens);
}

function getDefaultMarkedLexerOptions(markedInstance: Marked<string, unknown>): MarkedOptions<string, unknown> {
  return ({
    gfm: true,
    breaks: true,
    tokenizer: markedInstance.defaults.tokenizer
  }) as MarkedOptions<string, unknown>;
}
