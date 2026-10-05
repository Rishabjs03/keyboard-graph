import { paletteToTokens, themes, themeTokens } from './theme.js';

/**
 * Every visual of the component lives in this one stylesheet, shared by the React
 * wrapper (hoisted <style>) and the web component (adopted into its shadow root).
 *
 * Public theming surface (all optional):
 *   --kg-level-0 … --kg-level-4, --kg-side, --kg-shadow, --kg-plate, --kg-text,
 *   --kg-focus, --kg-highlight, --kg-tooltip-bg, --kg-tooltip-text, --kg-tooltip-border
 *     → override the colour in both schemes.
 *   --kg-light-<token> / --kg-dark-<token>
 *     → override one scheme only (this is what the `theme` prop writes).
 *   --kg-font → font stack.
 *
 * Internal custom properties are prefixed `--_` and are not part of the API.
 */

const defaults = {
  light: paletteToTokens(themes.github.light),
  dark: paletteToTokens(themes.github.dark),
};

function schemeBlock(scheme: 'light' | 'dark'): string {
  return themeTokens
    .map((t) => `--_${t}:var(--kg-${t},var(--kg-${scheme}-${t},${defaults[scheme][t]}));`)
    .join('');
}

const levelRules = [1, 2, 3, 4]
  .map((l) => `.kg-key[data-level="${l}"]{--_c:var(--_level-${l})}`)
  .join('');

export const keyboardGraphCSS = /* css */ `
.kg-root{${schemeBlock('light')}
--_font:var(--kg-font,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif);
--_max:16px;--_min:9px;--_gap-r:.25;--_radius-r:.24;--_sweep:0ms;
container-type:inline-size;display:block;position:relative;width:100%;max-width:100%;box-sizing:border-box;
color:var(--_text);font-family:var(--_font);font-size:12px;line-height:1.4;
-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;-webkit-text-size-adjust:100%}
.kg-root[data-scheme="dark"]{${schemeBlock('dark')}}
@media (prefers-color-scheme:dark){.kg-root[data-scheme="auto"]{${schemeBlock('dark')}}}
.kg-root *,.kg-root *::before,.kg-root *::after{box-sizing:border-box}

.kg-frame{--_cols:53;--_denom:68.15;--_pad:16px;
--_size:clamp(var(--_min),calc((100cqi - var(--_pad) * 2) / var(--_denom)),var(--_max));
--_gap:calc(var(--_size) * var(--_gap-r));--_r:calc(var(--_size) * var(--_radius-r));
--_label:clamp(9px,calc(var(--_size) * .7),12px);
--_board-w:calc(var(--_size) * var(--_denom) + var(--_pad) * 2)}
@container (max-width:640px){.kg-frame{--_pad:10px}}
.kg-root[data-responsive="scroll"] .kg-frame{--_size:var(--_max)}

.kg-header,.kg-footer{display:flex;align-items:center;justify-content:space-between;gap:8px 16px;flex-wrap:wrap;
width:min(100%,var(--_board-w));margin-inline:auto}
.kg-header[hidden],.kg-footer[hidden]{display:none}
.kg-header{margin-bottom:10px;min-height:24px}
.kg-footer{margin-top:10px;min-height:16px}
.kg-total{margin:0;font-size:13px;font-weight:500;font-variant-numeric:tabular-nums;letter-spacing:-.005em}
.kg-caption{margin:0;font-size:11.5px;opacity:.8}

.kg-years{display:inline-flex;flex-wrap:wrap;gap:2px;padding:2px;border-radius:999px;
background:color-mix(in oklab,var(--_plate),var(--_text) 8%)}
.kg-year{appearance:none;border:0;margin:0;background:transparent;color:inherit;font:inherit;font-size:11.5px;
line-height:1;padding:6px 10px;border-radius:999px;cursor:pointer;font-variant-numeric:tabular-nums;
transition:background-color .2s ease,color .2s ease,box-shadow .2s ease}
.kg-year:hover{background:color-mix(in oklab,var(--_plate),var(--_text) 5%)}
.kg-year[aria-pressed="true"]{background:var(--_plate);box-shadow:0 1px 2px rgb(0 0 0 / .12),0 0 0 .5px rgb(0 0 0 / .06)}
.kg-year:focus-visible,.kg-retry:focus-visible{outline:2px solid var(--_focus);outline-offset:1px}

.kg-scroller{position:relative;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x proximity;
overscroll-behavior-x:contain;scrollbar-width:thin;-webkit-overflow-scrolling:touch}
.kg-plate{position:relative;width:max-content;margin-inline:auto;padding:var(--_pad);
border-radius:calc(var(--_pad) * .85);background:var(--_plate);
box-shadow:inset 0 1px 0 rgb(255 255 255 / calc(var(--_highlight) * 1.4)),inset 0 0 0 1px rgb(0 0 0 / .045)}
.kg-root[data-plate="false"] .kg-plate{background:transparent;box-shadow:none;--_pad:6px}

.kg-board{display:grid;grid-template-areas:"keys";row-gap:calc(var(--_gap) * 1.5)}
.kg-board[data-days]{grid-template-columns:calc(var(--_size) * 1.9) auto;column-gap:var(--_gap);grid-template-areas:"days keys"}
.kg-board[data-months]{grid-template-areas:"months" "keys"}
.kg-board[data-days][data-months]{grid-template-areas:". months" "days keys"}
.kg-months{grid-area:months;display:grid;grid-template-columns:repeat(var(--_cols),var(--_size));
column-gap:var(--_gap);font-size:var(--_label);line-height:1;height:var(--_label)}
.kg-month{grid-row:1;white-space:nowrap;scroll-snap-align:start;scroll-margin-inline-start:calc(var(--_size) * 2.5 + var(--_pad))}
.kg-weekdays{grid-area:days;display:grid;grid-template-rows:repeat(7,var(--_size));row-gap:var(--_gap);
font-size:var(--_label);line-height:1;align-items:center}
.kg-weekday{grid-column:1;white-space:nowrap}
.kg-months,.kg-weekdays{user-select:none;-webkit-user-select:none;opacity:.85}

.kg-grid{grid-area:keys;position:relative;display:grid;grid-template-columns:repeat(var(--_cols),var(--_size));
grid-template-rows:repeat(7,var(--_size));gap:var(--_gap);outline:none}
.kg-fx{position:absolute;inset:0;pointer-events:none}
.kg-glow{position:absolute;left:0;top:0;width:calc(var(--_size) * 7);height:calc(var(--_size) * 7);
margin:calc(var(--_size) * -3.5) 0 0 calc(var(--_size) * -3.5);border-radius:50%;opacity:0;
background:radial-gradient(circle,var(--_gc) 0%,transparent 62%)}

.kg-key{--_c:var(--_level-0);position:relative;display:block;width:var(--_size);height:var(--_size);
margin:0;padding:0;border:0;border-radius:var(--_r);background:none;color:inherit;font:inherit;
appearance:none;-webkit-appearance:none;cursor:pointer;outline:none;-webkit-tap-highlight-color:transparent;
touch-action:manipulation;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;
transition:transform .18s cubic-bezier(.25,.8,.3,1)}
${levelRules}
.kg-shadow,.kg-skirt,.kg-cap{position:absolute;border-radius:var(--_r);pointer-events:none}
.kg-shadow{inset:16% 7% -1% 7%;transform-origin:50% 100%;
box-shadow:0 calc(var(--_size) * .12) calc(var(--_size) * .24) calc(var(--_size) * -.02) var(--_shadow)}
.kg-skirt{inset:0;background-color:color-mix(in oklab,var(--_c),var(--_side) 30%);
background-image:linear-gradient(90deg,rgb(0 0 0 / .1),transparent 26%,transparent 74%,rgb(0 0 0 / .1));
transition:background-color var(--_sweep) cubic-bezier(.4,0,.2,1) var(--kg-delay,0ms)}
.kg-cap{left:0;right:0;top:0;height:86%;transform-origin:50% 100%;background-color:var(--_c);
background-image:linear-gradient(180deg,rgb(255 255 255 / calc(var(--_highlight) * .9)) 0%,rgb(255 255 255 / 0) 36%,rgb(0 0 0 / .05) 100%);
box-shadow:inset 0 0 0 max(.5px,calc(var(--_size) * .03)) rgb(0 0 0 / .05),
inset 0 max(.5px,calc(var(--_size) * .04)) 0 rgb(255 255 255 / calc(var(--_highlight) * .8));
transition:background-color var(--_sweep) cubic-bezier(.4,0,.2,1) var(--kg-delay,0ms)}
.kg-cap::before{content:"";position:absolute;inset:13% 14% 15% 14%;border-radius:max(1px,calc(var(--_r) * .7));
background-image:radial-gradient(130% 100% at 50% 115%,rgb(255 255 255 / calc(var(--_highlight) * .8)),rgb(255 255 255 / 0) 64%),
linear-gradient(180deg,rgb(0 0 0 / .09),rgb(0 0 0 / 0) 60%);
box-shadow:inset 0 max(.5px,calc(var(--_size) * .03)) max(.5px,calc(var(--_size) * .05)) rgb(0 0 0 / .1)}
.kg-cap::after{content:"";position:absolute;inset:0;border-radius:inherit;opacity:0;
background:rgb(255 255 255 / calc(.1 + var(--_highlight) * .35));transition:opacity .16s ease}
@supports not (color:color-mix(in oklab,red,blue)){
.kg-skirt{background-color:var(--_c);background-image:linear-gradient(rgb(0 0 0 / .28),rgb(0 0 0 / .28))}}
@media (hover:hover){
.kg-key:hover{transform:translateY(calc(var(--_size) * -.06))}
.kg-key:hover .kg-cap::after{opacity:1}}
.kg-key:active .kg-cap{transform:translateY(13%)}
.kg-key:focus-visible{outline:2px solid var(--_focus);outline-offset:2px;z-index:2}
.kg-key[data-future]{opacity:.38;pointer-events:none;cursor:default}
.kg-key[data-skeleton]{pointer-events:none;cursor:default}
.kg-key[data-skeleton] .kg-cap::after{animation:kg-shimmer 1.6s ease-in-out infinite both;animation-delay:var(--d,0ms)}
.kg-root[data-state="error"] .kg-key[data-skeleton] .kg-cap::after{animation:none}
@keyframes kg-shimmer{0%,100%{opacity:0}45%{opacity:1}}
.kg-root[data-entrance="pending"] .kg-grid .kg-key{opacity:0;animation:kg-failsafe 1ms 2.5s forwards}
.kg-root[data-entrance="waiting"] .kg-grid .kg-key{opacity:0}
.kg-root[data-busy] .kg-grid{opacity:.55;transition:opacity .25s ease}
.kg-grid{transition:opacity .35s ease}
@keyframes kg-failsafe{to{opacity:1}}

.kg-legend{--_size:11px;--_r:calc(var(--_size) * var(--_radius-r));display:inline-flex;align-items:center;gap:4px;
font-size:11.5px;margin-left:auto}
.kg-legend .kg-key{pointer-events:none;cursor:default}
.kg-legend-label{margin:0 2px}

.kg-message{position:absolute;inset:0;display:grid;place-items:center;align-content:center;gap:10px;padding:16px;
text-align:center;font-size:13px;line-height:1.45;border-radius:inherit;
background:color-mix(in oklab,var(--_plate) 78%,transparent);-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px)}
.kg-message p{margin:0;max-width:44ch}
.kg-retry{appearance:none;border:0;margin:0;font:inherit;font-size:12px;font-weight:550;padding:7px 14px;border-radius:999px;
cursor:pointer;color:var(--_plate);background:var(--_text);transition:transform .15s ease,opacity .15s ease}
.kg-retry:hover{opacity:.9}.kg-retry:active{transform:scale(.97)}

.kg-tooltip{position:fixed;inset:auto;top:0;left:0;margin:0;z-index:2147483000;padding:6px 10px 7px;
border:1px solid var(--_tooltip-border);border-radius:8px;background:var(--_tooltip-bg);color:var(--_tooltip-text);
font:500 12px/1.35 var(--_font);letter-spacing:.005em;white-space:nowrap;pointer-events:none;overflow:visible;
box-shadow:0 10px 30px -10px rgb(0 0 0 / .45),0 2px 8px -2px rgb(0 0 0 / .2);transform-origin:var(--_ax,50%) 100%}
.kg-tooltip[data-placement="bottom"]{transform-origin:var(--_ax,50%) 0%}
.kg-tooltip[hidden]:not([popover]){display:none}
.kg-tooltip b{font-weight:650}
.kg-tooltip-arrow{position:absolute;left:var(--_ax,50%);bottom:-4.5px;width:8px;height:8px;margin-left:-4px;
background:var(--_tooltip-bg);border-right:1px solid var(--_tooltip-border);border-bottom:1px solid var(--_tooltip-border);
border-bottom-right-radius:2px;transform:rotate(45deg)}
.kg-tooltip[data-placement="bottom"] .kg-tooltip-arrow{bottom:auto;top:-4.5px;transform:rotate(225deg)}

.kg-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}

.kg-root[data-motion="reduce"] .kg-key,.kg-root[data-motion="reduce"] .kg-key:hover,.kg-root[data-motion="reduce"] .kg-key:active .kg-cap{transition:none;transform:none}
.kg-root[data-motion="reduce"] .kg-key[data-skeleton] .kg-cap::after{animation-duration:3s}
@media (prefers-reduced-motion:reduce){
.kg-root[data-motion="user"] .kg-key,.kg-root[data-motion="user"] .kg-key:hover,.kg-root[data-motion="user"] .kg-key:active .kg-cap{transition:none;transform:none}
.kg-root[data-motion="user"] .kg-key[data-skeleton] .kg-cap::after{animation-duration:3s}}
`
  .replace(/\n/g, '')
  .replace(/\s{2,}/g, ' ');
