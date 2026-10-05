# Examples

| Folder                             | What it shows                                                                                                     |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| [`plain-html`](./plain-html)       | The `<clacky-graph>` web component from a CDN, no build step, theming with CSS variables and listening to events. |
| [`proxy-vercel`](./proxy-vercel)   | A ~10-line Vercel Function that serves contributions from GitHub's GraphQL API with your own token.               |
| [`proxy-netlify`](./proxy-netlify) | The same proxy as a Netlify Function.                                                                             |

Both proxies use `createContributionsHandler` from `clacky/server`, which responds in the same
shape as the default public API, so the component only needs an `endpoint`:

```html
<clacky-graph
  username="octocat"
  endpoint="https://your-site.com/api/contributions/{username}?y={year}"
></clacky-graph>
```
