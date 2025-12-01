import type { ReactNode } from 'react';
import { createElement } from 'react';

export type HeadingLevels = 1 | 2 | 3 | 4 | 5 | 6;
export interface TableFlags {
  header?: boolean,
  align?: 'center' | 'left' | 'right' | undefined
}

export type CustomRendererMethods = Partial<Omit<FoxmdRenderer, 'elIdList' | 'elementId' | 'incrementElId'>>;

export interface FoxmdRendererOptions {
  suppressHydrationWarning?: boolean,
  customRenderMethods?: CustomRendererMethods,
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

function createInternalFoxmdRenderer(
  suppressHydrationWarning: boolean,
  specialImageSizeInTitleOrAlt: boolean,
  UNSAFE_allowHtml: boolean
) {
  const elIdList: number[] = [];

  function getElementId() {
    return elIdList.join('-');
  }

  function h<T extends keyof React.JSX.IntrinsicElements>(el: T, children: ReactNode = null, props: React.JSX.IntrinsicElements[T] = {}): ReactNode {
    const elProps = {
      key: 'foxmd-' + getElementId(),
      suppressHydrationWarning
    };
    return createElement(el, { ...props, ...elProps }, children);
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

    codespan(code: ReactNode, lang: string | null = null) {
      // TODO: add shiki here
      const className = lang ? `language-${lang}` : undefined;
      return h('code', code, { className });
    },

    code(code: ReactNode, lang: string | undefined = '') {
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

    html(html: string) {
      if (UNSAFE_allowHtml) {
        return h('div', null, {
          dangerouslySetInnerHTML: { __html: html },
          style: { display: 'contents' }
        });
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
  UNSAFE_allowHtml = false
}: FoxmdRendererOptions = {}) {
  const renderer = createInternalFoxmdRenderer(
    suppressHydrationWarning,
    specialImageSizeInTitleOrAlt,
    UNSAFE_allowHtml
  );
  return {
    ...renderer,
    ...customRenderMethods
  };
}

export type FoxmdRenderer = ReturnType<typeof createInternalFoxmdRenderer>;
