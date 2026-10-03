import { Router } from 'express';
import { z } from 'zod';
import { assertOwned, ctxOf, feedAccess, HttpError, nowIso, notFound, requireNavigatorWrite, type Deps } from '../http';
import { listWorkflows, syncExposure } from '../repo';
import { matchChange } from '../../shared/matching';
import { listEdges } from '../repo';
import { similarDecisions } from './history';

export function exposureRouter(deps: Deps): Router {
  const r = Router();
  const { db, feed } = deps;

  /** Every published change with the number of workflows it touches (computed, nothing persisted). */
  r.get('/changes', (req, res) => {
    const c = ctxOf(req);
    const scope = feedAccess(c);
    const workflows = listWorkflows(db, c.tenantId);
    const edges = listEdges(db, c.tenantId);
    const dismissed = new Map<string, Set<string>>();
    for (const d of db.prepare("SELECT change_id, workflow_id FROM exposure_matches WHERE tenant_id = ? AND review_state = 'dismissed'").all(c.tenantId) as { change_id: string; workflow_id: string }[]) {
      dismissed.set(d.change_id, (dismissed.get(d.change_id) ?? new Set()).add(d.workflow_id));
    }
    const changes = feed.listChanges(scope).map(ch => {
      const m = matchChange(ch, workflows, edges, dismissed.get(ch.id));
      const count = (s: string) => m.filter(x => x.status === s).length;
      return { change: ch, counts: { confirmed: count('confirmed'), possible: count('possible'), insufficient_information: count('insufficient_information') } };
    });
    res.json({ source: feed.source, hasWorkflows: workflows.length > 0, changes });
  });

  r.get('/changes/:id', (req, res) => {
    const c = ctxOf(req);
    const change = feed.getChange(feedAccess(c), req.params.id as string);
    if (!change) throw notFound('Change');
    const workflows = listWorkflows(db, c.tenantId);
    const matches = syncExposure(db, c.tenantId, change);
    const byId = new Map(workflows.map(w => [w.id, w]));
    const enriched = matches.map(m => ({ ...m, workflow: byId.get(m.workflowId)!, viaWorkflowName: m.viaWorkflowId ? byId.get(m.viaWorkflowId)?.name : undefined }));
    res.json({
      change,
      noInventory: workflows.length === 0,
      confirmed: enriched.filter(m => m.status === 'confirmed'),
      possible: enriched.filter(m => m.status === 'possible' && m.reviewState !== 'dismissed'),
      dismissed: enriched.filter(m => m.status === 'possible' && m.reviewState === 'dismissed'),
      insufficient: enriched.filter(m => m.status === 'insufficient_information'),
      notice: 'A workflow that is not listed is not affected only if its inventory is complete. Missing inventory data is never treated as absence of exposure.',
      similarDecisions: similarDecisions(db, c.tenantId, change, matches.map(m => m.workflowId)),
    });
  });

  r.patch('/exposure/:matchId/review', requireNavigatorWrite, (req, res) => {
    const c = ctxOf(req);
    assertOwned(db, 'exposure_matches', req.params.matchId, c.tenantId, 'Match');
    const body = z.object({ state: z.enum(['confirmed', 'dismissed', 'unreviewed']) }).parse(req.body);
    const m = db.prepare('SELECT status FROM exposure_matches WHERE id = ? AND tenant_id = ?').get(req.params.matchId, c.tenantId) as { status: string };
    if (m.status !== 'possible') throw new HttpError(422, 'Only possible matches can be reviewed. Confirmed matches stand and incomplete inventory must be completed, not dismissed.', 'not_reviewable');
    db.prepare('UPDATE exposure_matches SET review_state = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ? AND tenant_id = ?').run(body.state, c.userId, nowIso(), req.params.matchId, c.tenantId);
    res.json({ ok: true });
  });

  /** Weekly briefs as supporting context; each item links to the workflows it touches. */
  r.get('/briefs', (req, res) => {
    const c = ctxOf(req);
    const scope = feedAccess(c);
    const workflows = listWorkflows(db, c.tenantId);
    const edges = listEdges(db, c.tenantId);
    const weeks = feed.listBriefs(scope).map(w => ({
      weekStart: w.weekStart,
      items: w.items.map(change => {
        const m = matchChange(change, workflows, edges);
        return { change, affectedWorkflowIds: m.filter(x => x.status !== 'insufficient_information').map(x => x.workflowId), incompleteWorkflowCount: m.filter(x => x.status === 'insufficient_information').length };
      }),
    }));
    res.json({ source: feed.source, weeks });
  });

  return r;
}
