import { lazyValue } from 'foxts/lazy-value';
import type { MarkedOptions, MarkedToken, Token } from 'marked';
import { Marked } from 'marked';
import { createFoxmdRenderer } from './renderer';
import type { FoxmdRendererOptions } from './renderer';
import { createFoxmdParser } from './parser';
import type { FoxmdParserOptions } from './parser';
import { createSlugger, tokensToText } from './utils';

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
  markdownString: string | Token[],
  {
    foxmdRendererOptions,
    foxmdParserOptions,
    markedInstance = defaultMarkedInstance() as Marked,
    lexerOptions = getDefaultMarkedLexerOptions(markedInstance),
    isInline = false
  }: FoxmdOptions = {}
) {
  let tokens: MarkedToken[];
  if (typeof markdownString === 'string') {
    tokens = markedInstance.lexer(markdownString, lexerOptions) as MarkedToken[];
  } else {
    tokens = markdownString as MarkedToken[];
  }

  const defaultSlugger = createSlugger();

  const parser = createFoxmdParser(
    createFoxmdRenderer(foxmdRendererOptions),
    {
      slugize: defaultSlugger,
      ...foxmdParserOptions
    }
  );

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

export function markdownToText(markdownString: string | Token[], {
  markedInstance = defaultMarkedInstance() as Marked,
  lexerOptions = getDefaultMarkedLexerOptions(markedInstance),
  skipCodeBlock = false
}: MarkdownToTextOptions = {}): string {
  let tokens: MarkedToken[];
  if (typeof markdownString === 'string') {
    tokens = markedInstance.lexer(markdownString, lexerOptions) as MarkedToken[];
  } else {
    tokens = markdownString as MarkedToken[];
  }

  return tokensToText(tokens, skipCodeBlock);
}

export type ToCTree = {
  id?: string,
  index?: string,
  text?: string
} & {
  [key: string]: ToCTree
};

/**
 * Example
 * ```js
 * {
 *    "1": {
 *        "id": "foxmd-is-an-opinionated-library-that-can-turn-Markdown-string-into-React-ReactNodes",
 *        "index": "1"
 *    },
 *    "2": {
 *        "1": {
 *            "1": {
 *                "id": "Third-level-title",
 *                "index": "2.1.1"
 *            },
 *            "id": "Second-level-title",
 *            "index": "2.1"
 *        },
 *        "2": {
 *            "id": "Another-second-level-title",
 *            "index": "2.2"
 *        },
 *        "id": "First-level-title",
 *        "index": "2"
 *    }
 * }
 * ```
 */
export function tocArrayToTree(tocArray: Array<{
  text: string,
  id: string,
  level: number
}>): ToCTree {
  const tree: ToCTree = {};

  const levels = [0, 0, 0, 0, 0, 0];

  const minLevel = Math.min(...tocArray.map(item => item.level));

  for (let i = 0, len = tocArray.length; i < len; i++) {
    const item = tocArray[i];
    const { text, id } = item;
    const level = item.level - minLevel;

    for (let j = 0; j < 6; j++) {
      if (j > level) {
        levels[j] = 0;
      } else if (j < level) {
        if (levels[j] === 0) {
          // if headings start with a lower level heading, set the former heading index to 1
          // e.g. h3, h2, h1, h2, h3 => 1.1.1, 1.2, 2, 2.1, 2.1.1
          levels[j] = 1;
        }
      } else {
        levels[j] += 1;
      }
    }

    let node: ToCTree = tree;
    const $levels = levels.slice(0, level + 1);
    for (let k = 0, len = $levels.length; k < len; k++) {
      const item = $levels[k];
      if (!(item in node)) node[item] = {};
      node = node[item];
    }
    node.id = id;
    node.text = text;
    node.index = $levels.join('.');
  }

  return tree;
}
