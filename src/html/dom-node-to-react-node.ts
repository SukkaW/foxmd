import { createElement, Fragment } from 'react';
import type React from 'react';

import { isDocument } from 'domhandler';
import type { Element, Document } from 'domhandler';

import styleToObject from 'style-to-object';

import possibleStandardNames from './react-dom-possible-standard-names';
import { htmlBooleanAttributes, htmlOverloadedBooleanAttributes } from './react-dom-boolean-proeprty';

import { getHtmlTagReplaceReact } from '../utils';
import type { HtmlTagReplaceReact } from '../utils';

// will be bundled
import { voidHtmlTags } from 'html-tags';
import type { VoidHtmlTags } from 'html-tags';

export function domNodeToReactNode(node: Element | Document, children: React.ReactNode[] | null, elementId: string, customReactComponentsForHtmlTags: HtmlTagReplaceReact, index: number) {
  // The Custom Elements specification explicitly states that;
  // custom element names must contain a hyphen.
  // src: https://html.spec.whatwg.org/multipage/custom-elements.html#valid-custom-element-name
  const isCustomElementNode = 'name' in node && node.name.includes('-');

  const props: Record<string, any> = {
    key: 'foxmd-html-' + elementId + '-' + index + ('name' in node ? '-' + node.name : '')
  };
  if ('attribs' in node && node.attribs) {
    for (let key in node.attribs) {
      if (Object.hasOwn(node.attribs, key)) {
        if (isCustomElementNode) {
          props[key] = node.attribs[key];
          continue;
        }
        // ignore ref
        // ref is not a valid attribute in HTML. React no longer supports string ref as well
        // Besides, ref in this context makes no sense and there must be an error if we pass ref here.
        if (key === 'ref') {
          continue;
        }

        // ignore event handlers
        // we are doing this in React Server Component, event handler doesn't make sense and not allowed
        if (key.startsWith('on')) {
          continue;
        }

        const value = node.attribs[key];

        if (key.startsWith('data-') || key.startsWith('aria-')) {
          props[key] = value === '' ? true : value;
          continue;
        }

        const lowerKey = key.toLowerCase();
        if (lowerKey in possibleStandardNames) {
          key = possibleStandardNames[lowerKey as keyof typeof possibleStandardNames];
        }

        if (key === 'style') {
          props.style = styleToObject(value);
          continue;
        }

        // convert attribute to uncontrolled component prop (e.g., `value` to `defaultValue`)
        // https://react.dev/learn/sharing-state-between-components#controlled-and-uncontrolled-components
        if (
          (key === 'checked' || key === 'value')
          && node.attribs.type !== 'reset' && node.attribs.type !== 'submit'
        ) {
          // we know defaultChecked and defaultValue are in possibleStandardNames, just fallback to key in case
          key = possibleStandardNames[`default${lowerKey}` as keyof typeof possibleStandardNames] || key;
          continue;
        }

        if (htmlBooleanAttributes.has(key)) {
          props[key] = true;
          continue;
        }
        if (htmlOverloadedBooleanAttributes.has(key)) {
          props[key] = value === '' ? true : value;
          continue;
        }

        props[key] = value;
      }
    }
  }

  // TODO: check if we need to push node.data
  // const allChildren: React.ReactNode[] = [];
  // if ('data' in node && node.data != null) {
  //   allChildren.push(node.data as any);
  // }
  // appendArrayInPlace(allChildren, children);
  if ('data' in node && node.data != null) {
    console.warn('[foxmd] Unknown node.data found vs node:', { node, data: node.data });
  }

  if (isDocument(node)) {
    return createElement(Fragment, props, children);
  }

  if (isVoidHtmlTag(node.name)) {
    if (children?.length) {
      console.warn('[foxmd] Void HTML tag should not have children, foxmd push children after the self-closing tags.', { node, tag: node.name, children });

      return createElement(
        Fragment, null,
        createElement(getHtmlTagReplaceReact(node.name, customReactComponentsForHtmlTags), props),
        children
      );
    }
    return createElement(getHtmlTagReplaceReact(node.name, customReactComponentsForHtmlTags), props);
  }
  return createElement(getHtmlTagReplaceReact(node.name, customReactComponentsForHtmlTags), props, children);
}

const voidHtmlTagsSet = new Set<string>(voidHtmlTags);
export function isVoidHtmlTag(tagName: string): tagName is VoidHtmlTags {
  return voidHtmlTagsSet.has(tagName);
}
