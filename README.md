# foxmd

An opinionated library that can turn Markdown string into `React.ReactNode[]`.

## Why foxmd?

**Markdown with React**

It is very common to use Markdown files as a content source (either from CMS or local files) for React applications, for building interactive documentation sites, blogs, knowledge bases, etc. However, many existing Markdown renderers (like `marked.js` or `markdown-it`, and many more) focus on converting Markdown to static HTML strings, which has limitations when working with React:

- We have to use `dangerouslySetInnerHTML`, which can lead to security vulnerabilities if not handled properly.
- We cannot customize how static HTML strings are rendered using React components.
  - The most notable example would be links, where we often want to use meta-frameworks/router libraries' `<Link />` component instead of a standard `<a>` tag.

**Why not MDX**

MDX is somewhat a popular solution to this problem. In fact, I have been using MDX in some of my projects for a while, the most notable one being [MirrorZ Help](https://help.mirrorz.org) ([GitHub](https://github.com/mirrorz-org/mirrorz-help)). However, MDX has its own limitations:

- The entire "Unified" infrastructure ecosystem is just overly complicated. So you have Markdown/MDX, you will have to wrap them in a self-contained virtual file object `VFile`, and then you will have to process them through the Retext and/or Remark infrastructure. Then you will have to convert Markdown/MDX to HTML (not exactly, but you get the idea), and then process the HTML (actually it is HAST, but you get the idea) through Rehype infrastructure.
- The "Unified" ecosystem has an overly complicated AST structure.
  - Once I tried to write a custom Remark plugin to extract code string from an MDX code block component to extract and process some metadata (for the [MirrorZ Help](https://help.mirrorz.org) project I mentioned above). This is what I ended up with: https://github.com/mirrorz-org/mirrorz-help/blob/348843ef19e96c0924b6b334f58c94f832dd8e31/src/lib/server/remark-extract-code-from-codeblock.ts
  - Once I tried to port custom header ID generation logic from Gatsby (a React-based framework which also uses Remark), here is what I ended up with: https://github.com/mirrorz-org/mirrorz-help/blob/348843ef19e96c0924b6b334f58c94f832dd8e31/src/lib/server/remark-header-custom-id.ts
  - Do you like working with such complicated AST structures? Well, I don't.
- The MDX compiler only outputs the "code" string, not the actual React elements JavaScript objects. This is OK if your Markdown/MDX is all local files that can be compiled at build time (via a webpack loader or compiler plugin of sorts), but it becomes a huge problem when you want to load Markdown/MDX content from a CMS (a.k.a. Remote MDX). In this case, you will always end up using `eval` or `new Function` (`@mdx-js/mdx` even exposes `new Function` via its `run` and `runSync` exports).

**What makes foxmd different**

foxmd offers a more straightforward solution that focuses on very specific use cases, so it is way simpler and performant:

- foxmd only works with Markdown. So no need to deal with the complicated MDX syntax.
- foxmd turns Markdown into React elements directly without any intermediate steps, i.e., does not turn Markdown into HTML first.
- To work with Markdown directly, foxmd uses `marked.js`'s Tokenizer/Lexer to turn a Markdown string into a series of Tokens, and turns those Tokens directly into React elements, without generating or processing any AST.
- Even without an AST, foxmd still allows customization of how Markdown Tokens are rendered.
- foxmd also supports HTML inside Markdown (manual opt-in required). By using `htmlparser2` (one of the most performant JavaScript-based HTML parsers), foxmd can turn an HTML string into a series of "DOM" Tokens, and then render them into React elements (yes, still no AST here). This not only avoids the need for `dangerouslySetInnerHTML`, but also allows customization of how HTML tags are rendered.
- foxmd not only provides a way to customize how different Markdown Tokens are rendered, but also provides a way of customizing how different tags are rendered (which is similar to `MDXComponents`).
- In the end, foxmd produces React elements JavaScript objects directly, so you don't need to use `eval` or `new Function`.
- foxmd works on both the server and client sides. However, it is recommended to use foxmd within React Server Components to reduce the client bundle size. Since foxmd produces React elements as JavaScript objects, it is very easy to use foxmd in React Server Components and utilize foxmd's customization options to render specific parts (such as links) using React Client Components.
  - If you do need to run foxmd within the browser (e.g., in React Client Components), after minifying and bundling, the foxmd package size is around 190 KiB (68.6 KiB gzipped). And foxmd is fully synchronous and pure (without side effects), so you can even run foxmd directly in the components' render phase, without worrying about `useEffect`.

## Installation

```bash
# npm
npm install foxmd
# yarn
yarn add foxmd
# pnpm
pnpm add foxmd
```

## Usage

**Turn Markdown string into React elements**

```tsx
import { foxmd } from 'foxmd';
import Link from 'next/link';

export interface MarkdownComponentProps {
  filePath: string;
}

// Example React Server Component that renders Markdown content
export default async function MarkdownComponent({ slug }: MarkdownComponentProps) {
  /** Load your markdown string from file system, CMS, or other sources, in your React Server Component **/
  const markdownString = await fsp.readFile(filePath, 'utf-8');

  const { jsx, toc }: React.ReactNode[] = foxmd(markdownString, {
    // Whether to parse markdown as inline or as block, default to false (block)
    isInline: false,
    // Options for rendering markdown tokens
    foxmdRendererOptions: {
      // Whether to add `suppressHydrationWarning` to all elements, default to false
      // Note that if you override the default render methods, this option no longer applies
      suppressHydrationWarning: false,
      // Define how different markdown tokens should be rendered to React elements
      customRenderMethods: {
        // Here is an example of customizing how the Markdown "link" token is rendered
        link(reactKey: string, href: string, text: ReactNode, title?: string) {
          // You can even strip potentially dangerous links here
          if (href.startsWith('javascript:')) {
            href = '#';
          }
          return <Link key={reactKey} href={href} title={title}>{text}</Link>;
        }
      },
      // Define how different tags should be rendered to React elements.
      // This option is not applied to customized markdown token render method (overridden by `customRenderMethods` above)
      customReactComponentsForHtmlTags: {
        // Here is an example of customizing how `<a>` tag is rendered
        // This is just for demonstration purposes. In real-world usage, since you have already customized the "link" token render method above,
        // This option will not affect links from markdown (if you have "UNSAFE_allowHtml" enabled, links from inline HTML still apply).
        a: (props) => <Link {...props} />
      },
      // Whether to use `htmlparser2` to parse inline HTML and turn them into React elements, default to false
      //Even though foxmd does not use `dangerouslySetInnerHTML`, enabling this option may still introduce XSS security risks
      // if the markdown content is not sanitized properly
      UNSAFE_allowHtml: false
    },
    foxmdParserOptions: {
      // This is a very special option designed to work with Hexo (https://hexo.io/), a Node.js-powered static site generator.
      // Have I ever mentioned that foxmd is opinionated? This is one of those opinions. Default to false, only enable this if you know what you are doing.
      UNSAFE_pickSingleImageChildOutOfParentParagraph: false
    },
    // Options for the Marked.js lexer
    // By default, GFM and Breaks are enabled (opinionated choices), but you can always provide your own options here
    lexerOptions: {},
    // Sometimes Marked.js options are not enough, you may want to provide your own customized Marked.js instance,
    // e.g., enabling some Marked.js extensions/plugins that are not supported via options, and here is where you do it
    // Note that not all Marked.js extensions/plugins are compatible with foxmd, since foxmd only uses the Tokenizer/Lexer from Marked.js
    markedInstance: undefined,

    // Want to work with the Table of Contents (TOC)? No problem, foxmd gets you covered.
    //
    // foxmd has a built-in slugger that handles slug/id generation and collision avoidance out of the box.
    //
    // However, if you want to customize the slug/id generation logic (e.g., working with your existing system),
    // here is where you can provide your own slug/id generation function.
    slugize: (str: string) => {
      // Imagine you have set up a custom slug instance before foxmd() invocation
      //
      // import GithubSlugger from 'github-slugger'
      // const slugger = new GithubSlugger();
      return slugger.slug(str);

      // It is recommended to create one slugger instance per foxmd() call, so collision avoidance only tracks within
      // the current markdown content, which is also the foxmd built-in slugger does.
    }
  });

  // Note that the toc is a flat array of headings, with their level and text content.
  // Most likely, you will want to convert this flat array into a tree structure.
  // Currently, foxmd does not provide such utilities, but in the future, it may provide one, and as always, PR is welcome.
  console.log({ toc });

  return (
    <div>
      {/** Since foxmd returns an array of React elements, you can just use it directly in your React component */}
      {jsx}
    </div>
 );
}
```

**Get Pure Text version of the Markdown content**

Sometimes you may want to extract the pure text content from a Markdown string. Here are the most notable use cases:

- `<meta />` description for SEO or OpenGraph purpose
- Text preview/summaries/excerpts for article listing
- Search index
- Word counter/reading time estimator

And foxmd has got you covered:

```tsx
import { markdownToText } from 'foxmd';

// For the word counter/reading time estimator example, I use the "alfaaz" package here
// It is the fastest word counter library on Node.js with CJK support
import { countWords } from "alfaaz";

const markdownString = `
# Hello World
`;

const textContent = markdownToText(markdownString, {
  // You are already familiar with these options by now
 lexerOptions: {},
 markedInstance: undefined,
  // Whether to SKIP (NOT INCLUDE) code block content when extracting text, default to false
  // Enable this option if you don't want code block content to be included in the text content
  // Inline code (`code`) is always included
 skipCodeBlock: false
});

const wordCount = countWords(textContent);
```

## License

[MIT](LICENSE)

----

**foxmd** © [Sukka](https://github.com/SukkaW), Authored and maintained by Sukka with help from contributors ([list](https://github.com/SukkaW/foxmd/graphs/contributors)).

> [Personal Website](https://skk.moe) · [Blog](https://blog.skk.moe) · GitHub [@SukkaW](https://github.com/SukkaW) · Telegram Channel [@SukkaChannel](https://t.me/SukkaChannel) · Twitter [@isukkaw](https://twitter.com/isukkaw) · BlueSky [@skk.moe](https://bsky.app/profile/skk.moe) · Mastodon [@sukka@acg.mn](https://acg.mn/@sukka)

<p align="center">
  <a href="https://github.com/sponsors/SukkaW/">
    <img src="https://sponsor.cdn.skk.moe/sponsors.svg"/>
  </a>
</p>
