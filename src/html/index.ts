import { Parser as HtmlParser } from 'htmlparser2';
import { DomHandler, isCDATA, isComment, isDirective, isText } from 'domhandler';
import type { ChildNode } from 'domhandler';

import { domNodeToReactNode } from './dom-node-to-react-node';

export function htmlToReact(html: string, elementId: string): React.ReactNode[] {
  const handler = new DomHandler();
  const parser = new HtmlParser(handler, { decodeEntities: true });
  parser.parseComplete(html);

  return handler.dom.map((node, index) => traverseDom(node, index, elementId, 0));
};

function traverseDom(
  node: ChildNode, index: number,
  elementId: string,
  level = 0
): React.ReactNode | null {
  if (isDirective(node)) {
    return null;
  }
  if (isText(node)) {
    return node.data;
  }
  if (isComment(node)) {
    // The following doesn't work as the generated HTML results in
    // "&lt;!--  This is a comment  --&gt;"
    // return '<!-- ' + node.data + ' -->';
    return null;
  }
  if (isCDATA(node)) {
    // In XHTML, CDATA is used in script tag to avoid parsing < and &. In HTML, script is already CDATA
    // In modern HTML parser (a.k.a. modern browsers), CDATA is ignored (unless in forgein XML namespace like SVG or MathML)
    // We just ignore it here.
    return null;
  }

  let children: React.ReactNode[] | null = null;

  if ('children' in node && node.children.length > 0) {
    children = node.children.reduce<React.ReactNode[]>((acc, child, i) => {
      const node = traverseDom(child, i, elementId, level + 1);
      if (node != null) {
        acc.push(node);
      }
      return acc;
    }, []);
  }

  return domNodeToReactNode(node, children, elementId, index, level);
};
