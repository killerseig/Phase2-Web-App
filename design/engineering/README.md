# Engineering guide

Reviewed against the repository and official framework documentation on November 6, 2026.

Start with [the coding process](coding-process.md), then read the relevant current module contract. These documents describe Phase 2 specifically. They do not authorize a release or replace the owner’s latest instructions.

Reusable Vue/Firebase/architecture standards are being prepared separately in Atlas’s ChatGPT Space. Verified Space links are pending; this repository does not publish a duplicate foundation.

| Guide | Use it for |
| --- | --- |
| [Coding process](coding-process.md) | Checkout, design decisions, development, verification, handoffs and releases |
| [Phase 2 architecture facts](phase2-adoption.md) | Current versions, boundaries and product status |
| [Module contracts](module-contracts.md) | A short map of existing interfaces with source and test links |

The [product design index](../next-update/README.md) records requirements and decisions. The [Git workflow](../../GIT-WORKFLOW.md) owns branch and release policy. When changing a public module contract, update its card, affected tests and relevant design checkpoint in the same change. Keep implementation detail in source instead of copying it into multiple guides.
