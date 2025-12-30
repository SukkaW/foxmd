/* https://github.com/facebook/react/blob/65eec428c40d542d4d5a9c1af5c3f406aecf3440/packages/react-dom-bindings/src/client/ReactDOMComponent.js#L754 */
export const htmlBooleanAttributes = new Set([
  // Note: also a boolean prop, React DOM actually fallthrough as boolean prop,
  // but with extra warning logic in the dev build
  'inert',

  'allowFullScreen',
  'async',
  'autoPlay',
  'controls',
  'default',
  'defer',
  'disabled',
  'disablePictureInPicture',
  'disableRemotePlayback',
  'formNoValidate',
  'hidden',
  'loop',
  'noModule',
  'noValidate',
  'open',
  'playsInline',
  'readOnly',
  'required',
  'reversed',
  'scoped',
  'seamless',
  // Microdata
  'itemScope',

  // Note: This is a very special case, React DOM use special logic to handle this attribute
  // So we also treat it as boolean attribute here
  'autoFocus'
]);

/**
 * An attribute that can be used as a flag as well as with a value.
 * When true, it should be present (set either to an empty string or its name).
 * When false, it should be omitted.
 * For any other value, should be present with that value.
 */
export const htmlOverloadedBooleanAttributes = new Set([
  'capture',
  'download'
]);
