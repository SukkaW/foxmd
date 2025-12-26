import 'server-only';

import { lazyValue } from 'foxts/lazy-value';
import type { MarkedOptions, MarkedToken } from 'marked';
import { Marked } from 'marked';
import { createFoxmdRenderer } from './renderer';
import type { FoxmdRendererOptions } from './renderer';
import { createFoxmdParser } from './parser';
import type { FoxmdParserOptions } from './parser';
import { decode } from 'html-entities';
import { never } from 'foxts/guard';

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
}: MarkdownToTextOptions): string {
  return tokensToText(markedInstance.lexer(markdownString, lexerOptions) as MarkedToken[], skipCodeBlock);
}

function tokensToText(tokens: MarkedToken[], skipCodeBlock: boolean): string {
  let result = '';
  for (let i = 0, len = tokens.length; i < len; i++) {
    result += getToken(tokens[i], skipCodeBlock);
  }
  return result;
}

function getToken(token: MarkedToken, skipCodeBlock: boolean): string {
  switch (token.type) {
    case 'heading':
    case 'paragraph':
    case 'blockquote':
    case 'link':
    case 'list_item':
      return tokensToText(token.tokens as MarkedToken[], skipCodeBlock) + '\n';
    case 'text':
    case 'em':
    case 'strong':
    case 'codespan':
    case 'del':
    case 'escape':
      return decode(token.text);
    case 'code':
      if (skipCodeBlock) {
        return '';
      }
      return decode(token.text) + '\n';
    case 'br':
    case 'hr':
    case 'html':
    case 'image':
    case 'table':
    case 'def':
      return '\n';
    case 'space':
      return ' ';
    case 'list': {
      let listText = '';
      for (let j = 0, listLen = token.items.length; j < listLen; j++) {
        const item = token.items[j];
        listText += tokensToText(item.tokens as MarkedToken[], skipCodeBlock) + '\n';
      }
      return listText;
    }
    default:
      never(token, 'marked token');
  }
}
