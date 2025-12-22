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
  heading(this: FoxmdCustomRendererMethods, reactKey: string, children: ReactNode, level: HeadingLevels, id?: string): ReactNode,
  paragraph(this: FoxmdCustomRendererMethods, reactKey: string, children: ReactNode): ReactNode,
  link(this: FoxmdCustomRendererMethods, reactKey: string, href: string, text: ReactNode, title?: string): ReactNode,
  image(this: FoxmdCustomRendererMethods, reactKey: string, src: string, alt: string, title?: string): ReactNode,
  codespan(this: FoxmdCustomRendererMethods, reactKey: string, code: string, lang?: string | null): ReactNode,
  code(this: FoxmdCustomRendererMethods, reactKey: string, code: string, lang?: string): ReactNode,
  blockquote(this: FoxmdCustomRendererMethods, reactKey: string, children: ReactNode): ReactNode,
  list(this: FoxmdCustomRendererMethods, reactKey: string, children: ReactNode, ordered: boolean, start?: number): ReactNode,
  listItem(this: FoxmdCustomRendererMethods, reactKey: string, children: ReactNode[]): ReactNode,
  checkbox(this: FoxmdCustomRendererMethods, reactKey: string, checked?: boolean): ReactNode,
  table(this: FoxmdCustomRendererMethods, reactKey: string, children: ReactNode[]): ReactNode,
  tableHeader(this: FoxmdCustomRendererMethods, reactKey: string, children: ReactNode): ReactNode,
  tableBody(this: FoxmdCustomRendererMethods, reactKey: string, children: ReactNode[]): ReactNode,
  tableRow(this: FoxmdCustomRendererMethods, reactKey: string, children: ReactNode[]): ReactNode,
  tableCell(this: FoxmdCustomRendererMethods, reactKey: string, children: ReactNode[], flags: TableFlags): ReactNode,
  strong(this: FoxmdCustomRendererMethods, reactKey: string, children: ReactNode): ReactNode,
  em(this: FoxmdCustomRendererMethods, reactKey: string, children: ReactNode): ReactNode,
  del(this: FoxmdCustomRendererMethods, reactKey: string, children: ReactNode): ReactNode,
  text(this: FoxmdCustomRendererMethods, text: ReactNode): ReactNode,
  html(this: FoxmdCustomRendererMethods, reactKey: string, html: string): ReactNode | ReactNode[],
  hr(this: FoxmdCustomRendererMethods, reactKey: string): ReactNode,
  br(this: FoxmdCustomRendererMethods, reactKey: string): ReactNode
}

function createInternalFoxmdRenderer(
  suppressHydrationWarning: boolean,
  specialImageSizeInTitleOrAlt: boolean,
  customReactComponentsForHtmlTags: HtmlTagReplaceReact,
  UNSAFE_allowHtml: boolean
): FoxmdCustomRendererMethods {
  function h<T extends keyof React.JSX.IntrinsicElements>(el: T, reactKey: string, children: ReactNode = null, props: React.JSX.IntrinsicElements[T] = {}): ReactNode {
    const Comp = getHtmlTagReplaceReact(el, customReactComponentsForHtmlTags);
    const finalProps = Object.entries(props).reduce<object>((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {});
    if (suppressHydrationWarning) {
      finalProps.suppressHydrationWarning = true;
    }
    return createElement(Comp, finalProps, children);
  }

  return {
    heading(reactKey: string, children: ReactNode, level: HeadingLevels, id?: string) {
      return h(`h${level}`, reactKey, children, { id });
    },

    paragraph(reactKey: string, children: ReactNode) {
      return h('p', reactKey, children);
    },

    link(reactKey: string, href: string, text: ReactNode, title?: string) {
      if (href.startsWith('javascript:') || href.startsWith('data:') || href.startsWith('vbscript:')) {
        href = '';
      }

      return h('a', reactKey, text, { href, title /* , target: undefined */ });
    },

    image(reactKey: string, src: string, alt: string, title?: string) {
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

      return h('img', reactKey, null, { src, alt, title, width, height });
    },

    codespan(reactKey: string, code: string, lang: string | null = null) {
      // TODO: add shiki here
      const className = lang ? `language-${lang}` : undefined;
      return h('code', reactKey, code, { className });
    },

    code(reactKey: string, code: string, lang: string | undefined = '') {
      return h(
        'pre', reactKey,
        this.codespan(
          reactKey + '-codespan-' + lang,
          code, lang
        ),
        {
          // @ts-expect-error -- data attribute
          'data-language': (knownLangMap.has(lang) ? knownLangMap.get(lang)! : lang).toUpperCase()
        }
      );
    },

    blockquote(reactKey: string, children: ReactNode) {
      return h('blockquote', reactKey, children);
    },

    list(reactKey: string, children: ReactNode, ordered: boolean, start: number | undefined) {
      return h(ordered ? 'ol' : 'ul', reactKey, children, ordered && start !== 1 ? { start } : {});
    },

    listItem(reactKey: string, children: ReactNode[]) {
      return h('li', reactKey, children);
    },

    // eslint-disable-next-line sukka/bool-param-default -- renderer method
    checkbox(reactKey: string, checked: boolean | undefined) {
      return h('input', reactKey, null, {
        type: 'checkbox',
        disabled: true,
        checked
      });
    },

    table(reactKey: string, children: ReactNode[]) {
      return h('table', reactKey, children);
    },

    tableHeader(reactKey: string, children: ReactNode) {
      return h('thead', reactKey, children);
    },

    tableBody(reactKey: string, children: ReactNode[]) {
      return h('tbody', reactKey, children);
    },

    tableRow(reactKey: string, children: ReactNode[]) {
      return h('tr', reactKey, children);
    },

    tableCell(reactKey: string, children: ReactNode[], flags: TableFlags) {
      const tag = flags.header ? 'th' : 'td';
      return h(tag, reactKey, children, { align: flags.align });
    },

    strong(reactKey: string, children: ReactNode) {
      return h('strong', reactKey, children);
    },

    em(reactKey: string, children: ReactNode) {
      return h('em', reactKey, children);
    },

    del(reactKey: string, children: ReactNode) {
      return h('del', reactKey, children);
    },

    text(text: ReactNode) {
      return text;
    },

    html(reactKey: string, html: string): React.ReactNode | React.ReactNode[] {
      if (UNSAFE_allowHtml) {
        return htmlToReact(html, reactKey, customReactComponentsForHtmlTags);
      }
      return html;
    },

    hr(reactKey: string) {
      return h('hr', reactKey);
    },

    br(reactKey: string) {
      return h('br', reactKey);
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
