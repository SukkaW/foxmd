import type { ReactNode } from 'react';
import { createElement } from 'react';
import { htmlToReact } from './html';
import { getHtmlTagReplaceReact } from './utils';
import type { HtmlTagReplaceReact } from './utils';

export type HeadingLevels = 1 | 2 | 3 | 4 | 5 | 6;
export interface TableFlags {
  header?: boolean,
  align?: 'center' | 'left' | 'right' | undefined
}

export interface FoxmdRendererOptions {
  suppressHydrationWarning?: boolean,
  customRenderMethods?: Partial<FoxmdCustomRendererMethods>,
  customReactComponentsForHtmlTags?: HtmlTagReplaceReact,
  specialImageSizeInTitleOrAlt?: boolean,
  UNSAFE_allowHtml?: boolean
}

const knownLangMap = new Map([
  ['bash', 'shell'],
  ['zsh', 'shell'],
  ['sh', 'shell'],
  ['js', 'javascript'],
  ['ts', 'typescript'],
  ['py', 'python'],
  ['yml', 'yaml']
]);

export interface FoxmdCustomRendererMethods {
  // protected incrementElId(): void,
  heading(this: FoxmdActualRenderer, children: ReactNode, level: HeadingLevels, id?: string): ReactNode,
  paragraph(this: FoxmdActualRenderer, children: ReactNode): ReactNode,
  link(this: FoxmdActualRenderer, href: string, text: ReactNode, title?: string): ReactNode,
  image(this: FoxmdActualRenderer, src: string, alt: string, title?: string): ReactNode,
  codespan(this: FoxmdActualRenderer, code: string, lang?: string | null): ReactNode,
  code(this: FoxmdActualRenderer, code: string, lang?: string): ReactNode,
  blockquote(this: FoxmdActualRenderer, children: ReactNode): ReactNode,
  list(this: FoxmdActualRenderer, children: ReactNode, ordered: boolean, start?: number): ReactNode,
  listItem(this: FoxmdActualRenderer, children: ReactNode[]): ReactNode,
  checkbox(this: FoxmdActualRenderer, checked?: boolean): ReactNode,
  table(this: FoxmdActualRenderer, children: ReactNode[]): ReactNode,
  tableHeader(this: FoxmdActualRenderer, children: ReactNode): ReactNode,
  tableBody(this: FoxmdActualRenderer, children: ReactNode[]): ReactNode,
  tableRow(this: FoxmdActualRenderer, children: ReactNode[]): ReactNode,
  tableCell(this: FoxmdActualRenderer, children: ReactNode[], flags: TableFlags): ReactNode,
  strong(this: FoxmdActualRenderer, children: ReactNode): ReactNode,
  em(this: FoxmdActualRenderer, children: ReactNode): ReactNode,
  del(this: FoxmdActualRenderer, children: ReactNode): ReactNode,
  text(this: FoxmdActualRenderer, text: ReactNode): ReactNode,
  html(this: FoxmdActualRenderer, html: string): ReactNode | ReactNode[],
  hr(this: FoxmdActualRenderer): ReactNode,
  br(this: FoxmdActualRenderer): ReactNode
}

export interface FoxmdActualRenderer extends FoxmdCustomRendererMethods {
  readonly elementId: string
}

interface FoxmdPrivateRenderer extends FoxmdActualRenderer {
  // private methods or properties can be added here in the future
  incrementElId(): void,
  readonly elIdList: number[]
}

function createInternalFoxmdRenderer(
  suppressHydrationWarning: boolean,
  specialImageSizeInTitleOrAlt: boolean,
  customReactComponentsForHtmlTags: HtmlTagReplaceReact,
  UNSAFE_allowHtml: boolean
): FoxmdPrivateRenderer {
  const elIdList: number[] = [];

  function getElementId() {
    return elIdList.join('-');
  }

  function h<T extends keyof React.JSX.IntrinsicElements>(el: T, children: ReactNode = null, props: React.JSX.IntrinsicElements[T] = {}): ReactNode {
    const elProps = {
      key: 'foxmd-' + getElementId() + '-' + el,
      suppressHydrationWarning
    };
    const Comp = getHtmlTagReplaceReact(el, customReactComponentsForHtmlTags);
    return createElement(Comp, { ...props, ...elProps }, children);
  }

  return {
    get elIdList() {
      return elIdList;
    },
    get elementId() {
      return getElementId();
    },
    incrementElId() {
      elIdList[elIdList.length - 1] += 1;
    },

    heading(children: ReactNode, level: HeadingLevels, id?: string) {
      return h(`h${level}`, children, { id });
    },

    paragraph(children: ReactNode) {
      return h('p', children);
    },

    link(href: string, text: ReactNode, title?: string) {
      if (href.startsWith('javascript:') || href.startsWith('data:') || href.startsWith('vbscript:')) {
        href = '';
      }

      return h('a', text, { href, title, target: undefined });
    },

    image(src: string, alt: string, title?: string) {
      let width: string | undefined;
      let height: string | undefined;

      if (specialImageSizeInTitleOrAlt) {
        if (alt.includes('|')) {
          const [newAlt, sizeOrImageLocalPath] = alt.split('|');
          // eslint-disable-next-line @typescript-eslint/prefer-optional-chain -- empty string check
          if (sizeOrImageLocalPath && sizeOrImageLocalPath.includes('x')) {
            [width, height] = sizeOrImageLocalPath.split('x').map(i => i.trim());
            alt = newAlt;
          }
        }
        if (
          (width === undefined || height === undefined)
          && title?.includes('size:')
        ) {
          title = title.replace(/size:(\d+)x(\d+)/, ($, w, h) => {
            width = w;
            height = h;
            return '';
          });
        }
      }

      return h('img', null, { src, alt, title, width, height });
    },

    codespan(code: string, lang: string | null = null) {
      // TODO: add shiki here
      const className = lang ? `language-${lang}` : undefined;
      return h('code', code, { className });
    },

    code(code: string, lang: string | undefined = '') {
      return h(
        'pre', this.codespan(code, lang),
        {
          // @ts-expect-error -- data attribute
          'data-language': (knownLangMap.has(lang) ? knownLangMap.get(lang)! : lang).toUpperCase()
        }
      );
    },

    blockquote(children: ReactNode) {
      return h('blockquote', children);
    },

    list(children: ReactNode, ordered: boolean, start: number | undefined) {
      return h(ordered ? 'ol' : 'ul', children, ordered && start !== 1 ? { start } : {});
    },

    listItem(children: ReactNode[]) {
      return h('li', children);
    },

    // eslint-disable-next-line sukka/bool-param-default -- renderer method
    checkbox(checked: boolean | undefined) {
      return h('input', null, {
        type: 'checkbox',
        disabled: true,
        checked
      });
    },

    table(children: ReactNode[]) {
      return h('table', children);
    },

    tableHeader(children: ReactNode) {
      return h('thead', children);
    },

    tableBody(children: ReactNode[]) {
      return h('tbody', children);
    },

    tableRow(children: ReactNode[]) {
      return h('tr', children);
    },

    tableCell(children: ReactNode[], flags: TableFlags) {
      const tag = flags.header ? 'th' : 'td';
      return h(tag, children, { align: flags.align });
    },

    strong(children: ReactNode) {
      return h('strong', children);
    },

    em(children: ReactNode) {
      return h('em', children);
    },

    del(children: ReactNode) {
      return h('del', children);
    },

    text(text: ReactNode) {
      return text;
    },

    html(html: string): React.ReactNode | React.ReactNode[] {
      if (UNSAFE_allowHtml) {
        return htmlToReact(html, getElementId(), customReactComponentsForHtmlTags);
      }
      return html;
    },

    hr() {
      return h('hr');
    },

    br() {
      return h('br');
    }
  };
}

export function createFoxmdRenderer({
  suppressHydrationWarning = false,
  specialImageSizeInTitleOrAlt = true,
  customRenderMethods = {},
  customReactComponentsForHtmlTags = {},
  UNSAFE_allowHtml = false
}: FoxmdRendererOptions = {}) {
  const renderer = createInternalFoxmdRenderer(
    suppressHydrationWarning,
    specialImageSizeInTitleOrAlt,
    customReactComponentsForHtmlTags,
    UNSAFE_allowHtml
  );
  return {
    ...renderer,
    ...customRenderMethods
  };
}

export type FoxmdRenderer = ReturnType<typeof createInternalFoxmdRenderer>;
