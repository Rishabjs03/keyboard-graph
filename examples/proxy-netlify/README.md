# clacky proxy · Netlify

The same GraphQL proxy as a [Netlify Function](https://docs.netlify.com/functions/overview/).

```bash
cd examples/proxy-netlify
npm install
netlify env:set GITHUB_TOKEN <token>
netlify deploy --prod
```

```html
<clacky-graph
  username="octocat"
  endpoint="https://<your-site>.netlify.app/api/contributions/{username}?y={year}"
></clacky-graph>
```

See the [Vercel example](../proxy-vercel/README.md#token) for which token to create.
