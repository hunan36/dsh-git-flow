/**
 * The one stylesheet this plugin needs. Inline styles cannot reach inside the
 * primitive components (the checkbox labels its own text, the modal card owns
 * its width), so the few rules that must cross that boundary live here and are
 * installed once per client fiber.
 * @module dsh-git-flow/client/styles
 */
/**
 * Install the stylesheet for this fiber.
 * @returns a disposer removing the style element.
 */
export declare function installStyles(): () => void;
