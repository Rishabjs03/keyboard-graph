/**
 * clacky/element registers the `<clacky-graph>` custom element on import.
 *
 *   <script type="module">import 'clacky/element';</script>
 *   <clacky-graph username="octocat" theme="ocean" sound="blue"></clacky-graph>
 *
 * Safe to import during SSR: registration only happens in the browser.
 */
import { defineClacky, ClackyElement } from './element.js';

defineClacky();

export { defineClacky, ClackyElement };
export type { ClackyEventMap } from './element.js';
export type { ClackyHandle } from '../core/handle.js';
export type { ClackyOptions } from '../core/options.js';

declare global {
  interface HTMLElementTagNameMap {
    'clacky-graph': ClackyElement;
  }
}
