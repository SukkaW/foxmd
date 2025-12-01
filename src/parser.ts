import type { ReactNode } from 'react';
import type { Token, Tokens } from 'marked';

import type { HeadingLevels } from './renderer';
import type { FoxmdRenderer } from './renderer';
import { decode } from 'html-entities';
import { fastStringArrayJoin } from 'foxts/fast-string-array-join';
import { slugize } from './utils';

export function createFoxmdParser(renderer: FoxmdRenderer) {
  const headingIds = new Map<string, number>();

  function parse(tokens: Token[]): ReactNode[] {
    renderer.elIdList.push(0);

    const result = tokens.map((token) => {
      switch (token.type) {
        case 'space': {
          return null;
        }

        case 'heading': {
          const level = token.depth as HeadingLevels;
          let id = slugize(getText(token.tokens));

          let headingIndex = 1;
          if (headingIds.has(id)) {
            headingIndex = headingIds.get(id)! + 1;
            headingIds.set(id, headingIndex);

            id = id + '-' + headingIndex;
          } else {
            headingIds.set(id, headingIndex);
          }

          renderer.incrementElId();
          return renderer.heading(parseInline(token.tokens), level, id);
        }

        case 'paragraph': {
          renderer.incrementElId();
          return renderer.paragraph(parseInline(token.tokens));
        }

        case 'text': {
          const textToken = token as Tokens.Text;
          return textToken.tokens ? parseInline(textToken.tokens) : token.text;
        }

        case 'blockquote': {
          const blockquoteToken = token as Tokens.Blockquote;
          const quote = parse(blockquoteToken.tokens);

          renderer.incrementElId();
          return renderer.blockquote(quote);
        }

        case 'list': {
          const listToken = token as Tokens.List;

          renderer.elIdList.push(0);
          const children = listToken.items.map((item) => {
            const listItemChildren = [];

            if (item.task) {
              renderer.incrementElId();
              listItemChildren.push(renderer.checkbox(item.checked ?? false));
            }

            listItemChildren.push(parse(item.tokens));

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
          const headerCells = tableToken.header.map((cell, index) => renderer.tableCell(parseInline(cell.tokens), {
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
            const rowChildren = row.map((cell, index) => renderer.tableCell(parseInline(cell.tokens), {
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
    return result;
  };

  function parseInline(tokens: Token[] = []): ReactNode[] {
    renderer.elIdList.push(0);
    const result = tokens.map((token) => {
      switch (token.type) {
        case 'text': {
          renderer.incrementElId();
          return renderer.text(decode(token.text));
        }

        case 'strong': {
          renderer.incrementElId();
          return renderer.strong(parseInline(token.tokens));
        }

        case 'em': {
          renderer.incrementElId();
          return renderer.em(parseInline(token.tokens));
        }

        case 'del': {
          renderer.incrementElId();
          return renderer.del(parseInline(token.tokens));
        }

        case 'codespan': {
          renderer.incrementElId();
          return renderer.codespan(decode(token.text));
        }

        case 'link': {
          renderer.incrementElId();
          return renderer.link(token.href, parseInline(token.tokens), token.title ?? undefined);
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
    return result;
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
