import { escapeRegexp as escapeRegExp } from 'fast-escape-regexp';
import { remove as removeDiacritics } from 'remove-accents';

export function createSlugger() {
  const headingIds = new Map<string, number>();

  return (str: string) => {
    let id = slugize(str);

    let headingIndex = 1;
    if (headingIds.has(id)) {
      headingIndex = headingIds.get(id)! + 1;
      headingIds.set(id, headingIndex);

      id = id + '-' + headingIndex;
    } else {
      headingIds.set(id, headingIndex);
    }

    return id;
  };
}

// eslint-disable-next-line no-control-regex -- escaping
const rControl = /[\u0000-\u001F]/g;
const rSpecial = /[\s!"#$%&'()*+,./:;<=>?@[\\\]^_`{|}~-]+/g;

function slugize(str: string) {
  const separator = '-';
  const escapedSep = escapeRegExp(separator);

  const result = removeDiacritics(str)
    // Remove control characters
    .replaceAll(rControl, '')
    // Replace special characters
    .replaceAll(rSpecial, separator)
    // Remove continous separators
    .replaceAll(new RegExp(`${escapedSep}{2,}`, 'g'), separator)
    // Remove prefixing and trailing separtors
    .replaceAll(new RegExp(`^${escapedSep}+|${escapedSep}+$`, 'g'), '');

  return result.toLowerCase();
}

// ----------

export type HtmlTagReplaceReact = {
  [TagName in keyof React.JSX.IntrinsicElements]?: React.ComponentType<React.ComponentPropsWithoutRef<TagName>>;
};

// export function getHtmlTagReplaceReact<T extends keyof HtmlTagReplaceReact>(
//   tag: T,
//   customReactComponentsForHtmlTags: HtmlTagReplaceReact
// ): HtmlTagReplaceReact[T];

// This is to prevent "Expression produces a union type that is too complex to represent. ts(2590)"
export function getHtmlTagReplaceReact(
  tag: string,
  customReactComponentsForHtmlTags: HtmlTagReplaceReact
): string | React.ComponentType<any> {
  return tag in customReactComponentsForHtmlTags
    // @ts-expect-error --- IGNORE ---
    ? customReactComponentsForHtmlTags[tag]
    : tag;
}

import { never } from 'foxts/guard';
import { decode } from 'html-entities';
import type { MarkedToken } from 'marked';

// ----------

export function tokensToText(tokens: MarkedToken[], skipCodeBlock: boolean): string {
  let result = '';
  for (let i = 0, len = tokens.length; i < len; i++) {
    result += getToken(tokens[i], skipCodeBlock);
  }
  return result;
}

export function getToken(token: MarkedToken, skipCodeBlock: boolean): string {
  switch (token.type) {
    case 'text':
      if (token.tokens) {
        return tokensToText(token.tokens as MarkedToken[], skipCodeBlock);
      }
      return decode(token.text);
    case 'heading':
    case 'paragraph':
    case 'blockquote':
      return tokensToText(token.tokens as MarkedToken[], skipCodeBlock) + '\n';
    case 'link':
    case 'list_item':
      return tokensToText(token.tokens as MarkedToken[], skipCodeBlock);
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
      return token.raw;
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
