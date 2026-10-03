# Demo walkthrough

Start `npm run dev` and choose **Try the demo (sample data)**. Everything is fictional and labeled DEMO; URLs use `example.invalid`.

1. **My AI Operations**: six workflows with owners, criticality, vendors, spend (dated) and dependencies. Open the map, press Tab then Enter on a node, then see the same data in the table. “Contract clause review” has no vendor/model, so it shows data gaps.
2. **Exposure**: open the demo model-retirement notice. “Customer support reply drafting” is a *confirmed* match (“uses the model named in the announcement”); other workflows are *possible* (vendor-wide, or via dependency) or *insufficient information*.
3. **Decision Sandbox**: open the seeded decision. Compare keep / modify / alternative / fallback side by side; expand “Show formulas”. Switch between revision #1 and #2 (the assumption change created a new revision). Edit a rate and “Save as new revision”.
4. **Action Workspace**: open the seeded plan (approved against revision #2, completed). Create another with “Plan this option”, add a template, fill owner/due/criteria/tests/fallback/rollback, submit, and approve (owner/admin only). Try the **Rehearsals** tab to simulate a retirement, price increase or outage (SIMULATION; not in the feed).
5. **Decision History**: search “demo”; follow chain change → workflow → revision → plan → outcome. The recorded outcome compares forecast 210 vs observed 214 and 16 vs 22 migration hours, since currency, period and scope match.
6. Back in **Exposure**, a similar change shows the earlier decision with the basis it was matched on.

Production demo access is read-only (`demo-viewer`). Reset by deleting the dev database file.
