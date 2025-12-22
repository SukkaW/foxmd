import type { Token, Tokens } from 'marked';

import type { HeadingLevels } from './renderer';
import type { FoxmdRenderer } from './renderer';
import { decode } from 'html-entities';
import { fastStringArrayJoin } from 'foxts/fast-string-array-join';
import { slugize } from './utils';
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
  UNSAFE_pickSingleImageChildOutOfParentParagraph?: boolean
}

export function createFoxmdParser(
  renderer: FoxmdRenderer,
  {
    UNSAFE_pickSingleImageChildOutOfParentParagraph = false
  }: FoxmdParserOptions = {}
) {
  const headingIds = new Map<string, number>();

  const elIdList: number[] = [];
  const incrementElId = () => {
    elIdList[elIdList.length - 1] += 1;
  };
  const getReactKey = () => 'foxmd|' + elIdList.join('-');

  function parse(tokens: Token[]): FoxmdParserParseResult {
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
          return null;
        }

        case 'heading': {
          const level = token.depth as HeadingLevels;
          const text = getText(token.tokens);
          let id = slugize(text);

          let headingIndex = 1;
          if (headingIds.has(id)) {
            headingIndex = headingIds.get(id)! + 1;
            headingIds.set(id, headingIndex);

            id = id + '-' + headingIndex;
          } else {
            headingIds.set(id, headingIndex);
          }

          tocObj.push({ text, id, level });

          incrementElId();
          return renderer.heading(getReactKey(), parseInline(token.tokens).jsx, level, id);
        }

        case 'paragraph': {
          if (
            UNSAFE_pickSingleImageChildOutOfParentParagraph
            && token.tokens?.length === 1
            && token.tokens[0].type === 'image'
          ) {
            return parseInline(token.tokens).jsx;
          }

          incrementElId();
          return renderer.paragraph(getReactKey(), parseInline(token.tokens).jsx);
        }

        case 'text': {
          const textToken = token as Tokens.Text;
          if (inRawBlock) {
            bufferedRawBlockToken += token.text;
            return null;
          }

          return textToken.tokens ? parseInline(textToken.tokens).jsx : token.text;
        }

        case 'blockquote': {
          const blockquoteToken = token as Tokens.Blockquote;
          const quote = parse(blockquoteToken.tokens).jsx;

          incrementElId();
          return renderer.blockquote(getReactKey(), quote);
        }

        case 'list': {
          const listToken = token as Tokens.List;

          elIdList.push(0);
          const children = listToken.items.map((item) => {
            const listItemChildren: React.ReactNode[] = [];

            if (item.task) {
              incrementElId();
              listItemChildren.push(renderer.checkbox(getReactKey(), item.checked ?? false));
            }

            listItemChildren.push(parse(item.tokens).jsx);

            incrementElId();
            return renderer.listItem(getReactKey(), listItemChildren);
          });
          elIdList.pop();

          incrementElId();
          return renderer.list(getReactKey(), children, token.ordered, token.ordered ? token.start : undefined);
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
          const tableToken = token as Tokens.Table;

          elIdList.push(0);
          const headerCells = tableToken.header.map((cell, index) => {
            incrementElId();
            return renderer.tableCell(getReactKey(), parseInline(cell.tokens).jsx, {
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
              return renderer.tableCell(getReactKey(), parseInline(cell.tokens).jsx, {
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

  function parseInline(tokens: Token[] = []): FoxmdParserParseResult {
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
          return renderer.text(getReactKey(), decode(token.text));
        }

        case 'strong': {
          incrementElId();
          return renderer.strong(getReactKey(), parseInline(token.tokens).jsx);
        }

        case 'em': {
          incrementElId();
          return renderer.em(getReactKey(), parseInline(token.tokens).jsx);
        }

        case 'del': {
          incrementElId();
          return renderer.del(getReactKey(), parseInline(token.tokens).jsx);
        }

        case 'codespan': {
          incrementElId();
          return renderer.codespan(getReactKey(), decode(token.text));
        }

        case 'link': {
          incrementElId();
          return renderer.link(getReactKey(), token.href, parseInline(token.tokens).jsx, token.title ?? undefined);
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
          return renderer.text(getReactKey(), token.text);
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

function getText(tokens: Token[] = []): string {
  return fastStringArrayJoin(tokens.map((token) => {
    switch (token.type) {
      case 'text':
      case 'codespan':
      {
        return decode(token.text);
      }

      case 'strong':
      case 'em':
      case 'del':
      case 'link':
      {
        return getText(token.tokens);
      }

      case 'image': {
        return '';
      }

      case 'html':
      case 'br':
      case 'escape':
      {
        return '';
      }

      default: {
        // eslint-disable-next-line no-console -- dev warning
        console.warn(`[foxmd] Token with "${token.type}" type was not found`);
        return '';
      }
    }
  }), '-');
}
