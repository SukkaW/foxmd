import type { MarkedToken } from 'marked';

import type { HeadingLevels } from './renderer';
import type { FoxmdRenderer } from './renderer';
import { decode } from 'html-entities';
import { tokensToText } from './utils';
import type React from 'react';

export interface FoxmdParserParseResult {
  jsx: React.ReactNode[],
  toc: Array<{
    text: string,
    id: string,
    level: number
  }>
}

export interface FoxmdParserOptions {
  UNSAFE_pickSingleImageChildOutOfParentParagraph?: boolean,
  slugize?: (str: string) => string
}

interface InnerFoxmdParserOptions extends FoxmdParserOptions {
  slugize: (str: string) => string
}

export function createFoxmdParser(
  renderer: FoxmdRenderer,
  {
    UNSAFE_pickSingleImageChildOutOfParentParagraph = false,
    slugize
  }: InnerFoxmdParserOptions
) {
  const elIdList: number[] = [];
  const incrementElId = () => {
    elIdList[elIdList.length - 1] += 1;
  };
  const getReactKey = () => elIdList.join('-');

  function parse(tokens: MarkedToken[]): FoxmdParserParseResult {
    const tocObj: Array<{
      text: string,
      id: string,
      level: number
    }> = [];

    elIdList.push(0);

    let inRawBlock = false;
    let bufferedRawBlockToken = '';

    const result = tokens.map<React.ReactNode>((token): React.ReactNode => {
      switch (token.type) {
        case 'space': {
          return ' ';
        }

        case 'heading': {
          const level = token.depth as HeadingLevels;
          const text = tokensToText(token.tokens as MarkedToken[], true);
          const id = slugize(text);

          tocObj.push({ text, id, level });

          incrementElId();
          return renderer.heading(getReactKey(), parseInline(token.tokens as MarkedToken[]).jsx, level, id);
        }

        case 'paragraph': {
          if (
            UNSAFE_pickSingleImageChildOutOfParentParagraph
            && token.tokens.length === 1
            && token.tokens[0].type === 'image'
          ) {
            return parseInline(token.tokens as MarkedToken[]).jsx;
          }

          incrementElId();
          return renderer.paragraph(getReactKey(), parseInline(token.tokens as MarkedToken[]).jsx);
        }

        case 'text': {
          if (inRawBlock) {
            bufferedRawBlockToken += token.text;
            return null;
          }

          return token.tokens ? parseInline(token.tokens as MarkedToken[]).jsx : decode(token.text);
        }

        case 'blockquote': {
          const blockquoteToken = token;
          const quote = parse(blockquoteToken.tokens as MarkedToken[]).jsx;

          incrementElId();
          return renderer.blockquote(getReactKey(), quote);
        }

        case 'list': {
          const listToken = token;

          elIdList.push(0);
          const children = listToken.items.map((item) => {
            const listItemChildren: React.ReactNode[] = [];

            if (item.task) {
              incrementElId();
              listItemChildren.push(renderer.checkbox(getReactKey(), item.checked ?? false));
            }

            listItemChildren.push(parse(item.tokens as MarkedToken[]).jsx);

            incrementElId();
            return renderer.listItem(getReactKey(), listItemChildren);
          });
          elIdList.pop();

          incrementElId();
          return renderer.list(getReactKey(), children, token.ordered, token.ordered ? token.start : null);
        }

        case 'code': {
          incrementElId();
          return renderer.code(getReactKey(), token.text, token.lang);
        }

        case 'html': {
          if ('inRawBlock' in token) { // pre|code|kbd|script
            inRawBlock = token.inRawBlock;
          }
          if (inRawBlock) {
            bufferedRawBlockToken += token.text;
            return null;
          }

          incrementElId();
          const node = renderer.html(getReactKey(), bufferedRawBlockToken);
          bufferedRawBlockToken = '';
          return node;
        }

        case 'table': {
          const tableToken = token;

          elIdList.push(0);
          const headerCells = tableToken.header.map((cell, index) => {
            incrementElId();
            return renderer.tableCell(getReactKey(), parseInline(cell.tokens as MarkedToken[]).jsx, {
              header: true,
              align: token.align[index]
            });
          });
          elIdList.pop();

          incrementElId();
          const headerRow = renderer.tableRow(getReactKey(), headerCells);
          incrementElId();
          const header = renderer.tableHeader(getReactKey(), headerRow);

          elIdList.push(0);
          const bodyChilren = tableToken.rows.map((row) => {
            elIdList.push(0);
            const rowChildren = row.map((cell, index) => {
              incrementElId();
              return renderer.tableCell(getReactKey(), parseInline(cell.tokens as MarkedToken[]).jsx, {
                header: false,
                align: token.align[index]
              });
            });
            elIdList.pop();

            incrementElId();
            return renderer.tableRow(getReactKey(), rowChildren);
          });
          elIdList.pop();

          incrementElId();
          const body = renderer.tableBody(getReactKey(), bodyChilren);

          incrementElId();
          return renderer.table(getReactKey(), [header, body]);
        }

        case 'hr': {
          incrementElId();
          return renderer.hr(getReactKey());
        }

        default: {
          // eslint-disable-next-line no-console -- dev warning
          console.warn(`[foxmd] Token with "${token.type}" type was not found`);
          return null;
        }
      }
    });
    elIdList.pop();
    return {
      jsx: result,
      toc: tocObj
    };
  };

  function parseInline(tokens: MarkedToken[] = []): FoxmdParserParseResult {
    elIdList.push(0);

    let inRawBlock = false;
    let bufferedRawBlockToken = '';

    const result = tokens.map<React.ReactNode>((token): React.ReactNode => {
      switch (token.type) {
        case 'text': {
          if (inRawBlock) {
            bufferedRawBlockToken += token.text;
            return null;
          }

          incrementElId();
          return renderer.text(decode(token.text));
        }

        case 'strong': {
          incrementElId();
          return renderer.strong(getReactKey(), parseInline(token.tokens as MarkedToken[]).jsx);
        }

        case 'em': {
          incrementElId();
          return renderer.em(getReactKey(), parseInline(token.tokens as MarkedToken[]).jsx);
        }

        case 'del': {
          incrementElId();
          return renderer.del(getReactKey(), parseInline(token.tokens as MarkedToken[]).jsx);
        }

        case 'codespan': {
          incrementElId();
          return renderer.codespan(getReactKey(), decode(token.text));
        }

        case 'link': {
          incrementElId();
          return renderer.link(getReactKey(), token.href, parseInline(token.tokens as MarkedToken[]).jsx, token.title ?? undefined);
        }

        case 'image': {
          incrementElId();
          return renderer.image(getReactKey(), token.href, token.text, token.title);
        }

        case 'html': {
          if ('inRawBlock' in token) { // pre|code|kbd|script
            inRawBlock = token.inRawBlock;
          }
          if (inRawBlock) {
            bufferedRawBlockToken += token.text;
            return null;
          }

          incrementElId();
          const node = renderer.html(getReactKey(), bufferedRawBlockToken);
          bufferedRawBlockToken = '';
          return node;
        }

        case 'br': {
          incrementElId();
          return renderer.br(getReactKey());
        }

        case 'escape': {
          incrementElId();
          return renderer.text(token.text);
        }

        default: {
          // eslint-disable-next-line no-console -- dev warning
          console.warn(`[foxmd] Token with "${token.type}" type was not found`);
          return null;
        }
      }
    });
    elIdList.pop();
    return {
      jsx: result,
      toc: [] as never[]
    };
  }

  return {
    parse,
    parseInline
  };
}
