# docs/security/ instructions

Owner: Integrator. Exclusive task paths: `docs/security/data/**`,
`docs/security/IMPLEMENTATION_LOG.md`, `docs/security/tasks/**`.
Shared policy: `development-policy.md`.

`data/security_plan.json` is the canonical register. Workers may propose edits
by stable ID and baseline revision; only the integrator reconciles them and
increments `revision`. Never delete superseded decisions or evidence.

The numbered specification files are adopted copies of the reviewed planning
package. Preserve their planning-only statements as history; implementation
status lives in the register, `IMPLEMENTATION_LOG.md` and the task records.

Task records use the schema in `templates/agent_guides.md` section 7. `null`
means unavailable or unassigned, never completed. A gate is `passed` only with
concrete evidence in `release_gates[].evidence`.
