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

  function parse(tokens: Token[]): FoxmdParserParseResult {
    const tocObj: Array<{
      text: string,
      id: string,
      level: number
    }> = [];

    renderer.elIdList.push(0);

    const result = tokens.map<React.ReactNode>((token) => {
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

          renderer.incrementElId();
          return renderer.heading(parseInline(token.tokens).jsx, level, id);
        }

        case 'paragraph': {
          if (
            UNSAFE_pickSingleImageChildOutOfParentParagraph
            && token.tokens?.length === 1
            && token.tokens[0].type === 'image'
          ) {
            return parseInline(token.tokens).jsx;
          }

          renderer.incrementElId();
          return renderer.paragraph(parseInline(token.tokens).jsx);
        }

        case 'text': {
          const textToken = token as Tokens.Text;
          return textToken.tokens ? parseInline(textToken.tokens).jsx : token.text;
        }

        case 'blockquote': {
          const blockquoteToken = token as Tokens.Blockquote;
          const quote = parse(blockquoteToken.tokens).jsx;

          renderer.incrementElId();
          return renderer.blockquote(quote);
        }

        case 'list': {
          const listToken = token as Tokens.List;

          renderer.elIdList.push(0);
          const children = listToken.items.map((item) => {
            const listItemChildren: React.ReactNode[] = [];

            if (item.task) {
              renderer.incrementElId();
              listItemChildren.push(renderer.checkbox(item.checked ?? false));
            }

            listItemChildren.push(parse(item.tokens).jsx);

            renderer.incrementElId();
            return renderer.listItem(listItemChildren);
          });
          renderer.elIdList.pop();

          renderer.incrementElId();
          return renderer.list(children, token.ordered, token.ordered ? token.start : undefined);
        }

        case 'code': {
          renderer.incrementElId();
          return renderer.code(token.text, token.lang);
        }

        case 'html': {
          renderer.incrementElId();
          return renderer.html(token.text);
        }

        case 'table': {
          const tableToken = token as Tokens.Table;

          renderer.elIdList.push(0);
          const headerCells = tableToken.header.map((cell, index) => renderer.tableCell(parseInline(cell.tokens).jsx, {
            header: true,
            align: token.align[index]
          }));
          renderer.elIdList.pop();

          renderer.incrementElId();
          const headerRow = renderer.tableRow(headerCells);
          renderer.incrementElId();
          const header = renderer.tableHeader(headerRow);

          renderer.elIdList.push(0);
          const bodyChilren = tableToken.rows.map((row) => {
            renderer.elIdList.push(0);
            const rowChildren = row.map((cell, index) => renderer.tableCell(parseInline(cell.tokens).jsx, {
              header: false,
              align: token.align[index]
            }));
            renderer.elIdList.pop();

            renderer.incrementElId();
            return renderer.tableRow(rowChildren);
          });
          renderer.elIdList.pop();

          renderer.incrementElId();
          const body = renderer.tableBody(bodyChilren);

          renderer.incrementElId();
          return renderer.table([header, body]);
        }

        case 'hr': {
          renderer.incrementElId();
          return renderer.hr();
        }

        default: {
          // eslint-disable-next-line no-console -- dev warning
          console.warn(`[foxmd] Token with "${token.type}" type was not found`);
          return null;
        }
      }
    });
    renderer.elIdList.pop();
    return {
      jsx: result,
      toc: tocObj
    };
  };

  function parseInline(tokens: Token[] = []): FoxmdParserParseResult {
    renderer.elIdList.push(0);
    const result = tokens.map((token) => {
      switch (token.type) {
        case 'text': {
          renderer.incrementElId();
          return renderer.text(decode(token.text));
        }

        case 'strong': {
          renderer.incrementElId();
          return renderer.strong(parseInline(token.tokens).jsx);
        }

        case 'em': {
          renderer.incrementElId();
          return renderer.em(parseInline(token.tokens).jsx);
        }

        case 'del': {
          renderer.incrementElId();
          return renderer.del(parseInline(token.tokens).jsx);
        }

        case 'codespan': {
          renderer.incrementElId();
          return renderer.codespan(decode(token.text));
        }

        case 'link': {
          renderer.incrementElId();
          return renderer.link(token.href, parseInline(token.tokens).jsx, token.title ?? undefined);
        }

        case 'image': {
          renderer.incrementElId();
          return renderer.image(token.href, token.text, token.title);
        }

        case 'html': {
          renderer.incrementElId();
          return renderer.html(token.text);
        }

        case 'br': {
          renderer.incrementElId();
          return renderer.br();
        }

        case 'escape': {
          renderer.incrementElId();
          return renderer.text(token.text);
        }

        default: {
          // eslint-disable-next-line no-console -- dev warning
          console.warn(`[foxmd] Token with "${token.type}" type was not found`);
          return null;
        }
      }
    });
    renderer.elIdList.pop();
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
