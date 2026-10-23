# Source checkout and releases

Open this repository's root folder in VS Code, or use **File → Add local repository** in GitHub Desktop. The default branch is `main`. The separate local review copy and its emulator recovery exports are not part of this repository.

Install dependencies with `npm ci` and `npm --prefix functions ci`. Copy `.env.example` to `.env.local` and provide the public Firebase web configuration for the intended environment. Keep provider credentials and private documents out of Git. Functions output is generated with `npm --prefix functions run build`; the full build also produces the public renderer.

Before pushing, run the appropriate type, lint, unit and browser checks. The Shop Orders release gate remains `npm run test:shop-order-layout` (47 synthetic browser cases); `npm run verify:shop-order-layout` checks the delivered live CSS after an explicitly approved deployment. Production deployment is a separate action from committing or pushing.

## Recorded live application

The reviewed employee frontend was deployed on October 23, 2026 to `https://phase2-website.web.app`, Hosting version `4722644cb4d8ecad`, release `1792718363175000`. Its tested source was based on commit `18df20e3c041ff6d77cb85a1f9338b166f1ad9d3`. Public website assets, backend services and production business records were preserved. A Git push does not reproduce private content ingestion or change deployed form definitions.

Forms are stored in the database. Recipient controls concern emailed answer summaries. Public additional-recipient verification is an optional notification feature: its source module is not exported/deployed, and no approval has been given to deploy or enable it. Ordinary signed-in Jobs submissions do not require that endpoint. Production authenticated acceptance and real email delivery remain separate verification limits.

No GitHub Actions workflow is currently configured in this source. Inspect repository checks and external deployment integrations before assuming a future push is deployment-free.
