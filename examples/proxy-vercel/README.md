# clacky proxy · Vercel

A tiny Vercel Function that fetches contribution data from **GitHub's GraphQL API** with your own token.

```bash
cd examples/proxy-vercel
npm install
vercel env add GITHUB_TOKEN   # paste a token (see below)
vercel deploy
```

Then point the component at it:

```tsx
<Clacky
  username="octocat"
  endpoint="https://<your-app>.vercel.app/api/contributions?username={username}&y={year}"
/>
```

**Token:** create a [fine-grained personal access token](https://github.com/settings/personal-access-tokens/new)
with **no repository access and no permissions**. Public contribution data needs nothing more. GitHub allows
5,000 GraphQL points per hour per token; each request costs 1 point, and responses are CDN-cached for an hour.
