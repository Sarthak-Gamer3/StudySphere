# Connect StudySphere AI Tutor (secure setup)

The AI chat UI is included, but it will not generate live answers until you deploy a backend and connect it. GitHub Pages is static hosting and must never contain your private AI key.

## What this enables

The tutor is designed for Class 11 and 12 academic questions across Science, Commerce, Humanities/Arts, English/Hindi, Computer Science/IP and related subjects. It can explain concepts, solve problems step by step, produce exam-style answers, make revision notes and generate practice questions. No model can guarantee every answer is correct; students should verify syllabus-specific information with their current textbook and teacher.

## 1. Get a Gemini API key

1. Open Google AI Studio: https://aistudio.google.com/app/apikey
2. Create an API key and review the provider's current terms, availability, quotas and privacy settings. Free quota may be limited and can change.
3. Do not paste the key into GitHub, `config.js`, `app.js`, or any public file.

## 2. Deploy the backend on Cloudflare Workers

1. Create/sign in to a Cloudflare account: https://dash.cloudflare.com/
2. Go to **Workers & Pages** and create a Worker.
3. Replace the sample Worker code with the contents of `ai-worker.js`, then deploy it.
4. In the Worker settings, open **Variables and Secrets**. Add a secret named `GEMINI_API_KEY` and paste the API key value. Save, then redeploy if prompted.
5. Copy the deployed Worker URL. It should look similar to `https://your-worker-name.your-subdomain.workers.dev`.

The Worker currently allows requests from `https://sarthak-gamer3.github.io` and `http://localhost:8788`. If you publish the site at another URL or use a custom domain, update `ALLOWED_ORIGIN` in `ai-worker.js` and redeploy.

## 3. Connect the website

1. In your GitHub repository, open `config.js` and click Edit (pencil).
2. Replace the empty `AI_ENDPOINT` value with your Worker URL, for example:

```js
AI_ENDPOINT: "https://your-worker-name.your-subdomain.workers.dev",
```

3. Commit the change. Wait for GitHub Pages to update, then hard-refresh the site with **Command + Shift + R** on Mac.
4. Open **AI Tutor**, choose Class, Stream, Subject, Board and Answer style, then ask a test question.

## 4. If it does not answer

- “AI backend is not configured”: the Worker secret is missing or named incorrectly.
- “Origin not allowed”: your published site URL does not match `ALLOWED_ORIGIN`.
- “API key not valid”: create a new provider key and update the Worker secret.
- “Quota” or `429`: the provider's quota/rate limit was reached; check provider usage and billing settings.
- Network/CORS error: verify the Worker URL and allowed origin.

## Privacy and cost safeguards

- Never expose the API key in a public repository.
- Review the AI provider's data-use and retention terms before letting students submit personal information. Tell students not to enter passwords, addresses or other sensitive details.
- The Worker limits message length and request body size, but before sharing widely, add a stronger rate limiter and usage budget. Browser-only rate limits are not sufficient. Monitor usage to avoid unexpected charges.
- Do not promise that the AI answers literally everything or that every answer is correct. Check important calculations, textbook editions and board-specific exam requirements.
