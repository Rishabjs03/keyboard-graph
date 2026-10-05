/**
 * keyboard-graph/element — registers the `<keyboard-graph>` custom element on import.
 *
 *   <script type="module">import 'keyboard-graph/element';</script>
 *   <keyboard-graph username="octocat" theme="ocean" sound="blue"></keyboard-graph>
 *
 * Safe to import during SSR: registration only happens in the browser.
 */
import { defineKeyboardGraph, KeyboardGraphElement } from './element.js';

defineKeyboardGraph();

export { defineKeyboardGraph, KeyboardGraphElement };
export type { KeyboardGraphEventMap } from './element.js';
export type { KeyboardGraphHandle } from '../core/handle.js';
export type { KeyboardGraphOptions } from '../core/options.js';

declare global {
  interface HTMLElementTagNameMap {
    'keyboard-graph': KeyboardGraphElement;
  }
}
