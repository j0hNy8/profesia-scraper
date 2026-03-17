---
name: profesia-scout
description: "Run, inspect, or resume the Profesia.sk daily scouting state machine in projects/profesia-scout: start from cron-produced daily scrape data, analyze fit with Axiom, pause for the user's selection, and optionally research selected companies with Pulsar or draft cover letters with Lumina/generic templates."
---

# Profesia Scout

Use this skill when the task is to run, inspect, resume, or summarize the user's Profesia.sk pipeline in `/home/ubuntu/.openclaw/workspace/projects/profesia-scout`.

## When to use

Use it for requests like:
- run today's Profesia scan
- check what stage today's run is in
- analyze today's Profesia jobs
- show today's strong/potential matches
- resume after the user selected target companies
- research selected companies
- draft cover letters for selected targets
- generate faster generic applications when full custom research/writing is unnecessary

Do **not** use it for unrelated CV rewriting, LinkedIn tasks, or generic career advice outside this project.

## Canonical paths

Live project root:
- `/home/ubuntu/.openclaw/workspace/projects/profesia-scout`

Primary project files:
- `/home/ubuntu/.openclaw/workspace/projects/profesia-scout/config/workflow-state.json`
- `/home/ubuntu/.openclaw/workspace/projects/profesia-scout/config/scraper.js`
- `/home/ubuntu/.openclaw/workspace/projects/profesia-scout/prompts/analyzer.md`
- `/home/ubuntu/.openclaw/workspace/projects/profesia-scout/prompts/researcher.md`
- `/home/ubuntu/.openclaw/workspace/projects/profesia-scout/prompts/writer.md`
- `/home/ubuntu/.openclaw/workspace/projects/profesia-scout/cv/*.md`
- `/home/ubuntu/.openclaw/workspace/memory/seniority-matrix.md`

Daily outputs live in:
- `/home/ubuntu/.openclaw/workspace/projects/profesia-scout/YYYY-MM-DD/`
  - `listings.json`
  - `descriptions.json`
  - `report.md`
  - `{company-slug}/company-research.md`
  - `{company-slug}/cover-letter.md`

## Path corrections from older examples

Prefer the live paths above. Do **not** use stale examples such as:
- `~/.openclaw/workspace/profesia-scout`
- `/home/ubuntu/.openclaw/workspace/job-search-profesia/...`
- `/workflows/active/profesia-state.json`
- split `workspace-axiom` / `workspace-pulsar` / `workspace-lumina` project layouts
- a separate `references/` directory for orchestration logic

All orchestration guidance belongs in this single `SKILL.md`.

## Operating model

This is a **daily pipeline / state machine**, not one monolithic prompt.

The real control plane is:
- daily date folder under `projects/profesia-scout/YYYY-MM-DD/`
- global state file at `projects/profesia-scout/config/workflow-state.json`

Treat each phase as a distinct worker role that is run via `sessions_spawn` / spawned sessions/subagents when the interactive pipeline advances. Do **not** pretend one agent is internally doing every role with one continuous identity.

Current role mapping:
- **Daily scraper** → cron-managed background data collection
- **Analyzer = `axiom`**
- **Researcher = `pulsar`**
- **Writer = `lumina`**

Prompt contract for spawned phase workers:
- analyzer task must explicitly tell `axiom` to read and execute `projects/profesia-scout/prompts/analyzer.md`
- researcher task must explicitly tell `pulsar` to read and execute `projects/profesia-scout/prompts/researcher.md`
- writer task must explicitly tell `lumina` to read and execute `projects/profesia-scout/prompts/writer.md`
- writer task must also pass an explicit cover-letter language control value: `language=sk` or `language=en`
- do **not** let the writer infer cover-letter language from agent defaults, persona defaults, or generic locale assumptions

Different agents may have different soul/identity/tone. That is fine. What matters is that they read the correct local prompt/files for their phase and write outputs back into the shared project/state structure.

## Source of truth

Prefer current local files in this order:
1. `projects/profesia-scout/config/workflow-state.json`
2. `projects/profesia-scout/config/README.md`
3. `projects/profesia-scout/README.md`
4. phase prompt in `projects/profesia-scout/prompts/`
5. existing daily output files for the target date

If an older note or example conflicts with the current project files, the current project files win.

## Inputs you may need

Depending on the phase:
- target date `YYYY-MM-DD`; default to today if omitted
- whether the user wants full pipeline, next pending phase, or a specific phase only
- selected target companies after analysis
- cover-letter language: `SK` or `EN`
- whether the user wants **full custom mode** or **reduced mode**

If company selection is missing, stop after analysis and ask which companies should move forward.

## State model

Always read `/home/ubuntu/.openclaw/workspace/projects/profesia-scout/config/workflow-state.json` first.

Per date entry, track at least:
- `date`
- `scraper.status`
- `scraper.jobs_passed_filter`
- `analyzer.status`
- `analyzer.strong_matches`
- `analyzer.potential_matches`
- `researcher.status`
- `researcher.companies_researched`
- `writer.status`
- `writer.applications_drafted`

Use the state file to decide what is pending, in progress, completed, skipped, or safe to resume. Do not rerun completed phases unless the user explicitly wants regeneration.

## State-machine sequence

Canonical interactive flow for one date:
1. `analyzer` (Axiom)
2. `human_pause`
3. `researcher` (Pulsar) — optional when the user wants company research
4. `writer` (Lumina or reduced-mode generic drafting)

The scraper is expected to run daily via cron before the interactive pipeline starts.

### Transition rules

- If today's cron-produced scrape output is missing, stale, or clearly failed, stop and report that the data-collection prerequisite is not ready. Only mention rerunning the scraper as a fallback when the user explicitly asks or when recovery is required.
- If today's scrape produced `0` usable jobs, downstream phases should be skipped.
- If analyzer is pending and `descriptions.json` exists, analyzer is the next step.
- After analyzer completes, **pause for the user's selection**.
- Do **not** auto-research every strong/potential company.
- Research only selected targets.
- Write only for selected targets.
- Writer normally follows research, but in reduced mode it may generate a generic letter without custom research when the user explicitly wants speed over customization.

## Data-collection prerequisite

Daily scraping is handled by cron, not by the normal interactive skill flow.

Expected cron-managed outputs:
- `projects/profesia-scout/YYYY-MM-DD/listings.json`
- `projects/profesia-scout/YYYY-MM-DD/descriptions.json`
- updated scraper state in `projects/profesia-scout/config/workflow-state.json`

Operational rule:
- Treat scraper output as background input.
- Do not present scraping as a normal interactive step.
- Only inspect scraper state/output and continue from analysis onward.
- If the cron run failed or data is missing, report the missing prerequisite and stop unless the user explicitly wants recovery/rerun work.

### 1) Analyzer — Axiom

Purpose:
- classify scraped jobs conservatively as `strong`, `potential`, or `filtered`

Primary inputs:
- `projects/profesia-scout/YYYY-MM-DD/descriptions.json`
- `memory/seniority-matrix.md`
- `projects/profesia-scout/prompts/analyzer.md`
- `projects/profesia-scout/config/workflow-state.json`

Expected outputs:
- `projects/profesia-scout/YYYY-MM-DD/report.md`
- updated analyzer counts/status in workflow state

Rules to preserve:
- the user's strongest lane is ERP / JD Edwards / manufacturing-process support
- Linux/infrastructure = junior-entry
- General sysadmin / IT support = junior, support-oriented
- DevOps/cloud = junior-entry, project-based
- Data/BI = junior, strongest when overlapping with ERP, reporting, operations, manufacturing data
- Security = entry level only
- Be conservative with `STRONG`
- Hard blockers or clear medior/senior stack ownership must demote to `POTENTIAL` or `FILTER`
- No German-required roles
- No hallucinated requirements

Necessity:
- For this pipeline, analyzer is the **core** decision phase. If `descriptions.json` exists and no report exists, this is usually the required next step.

### 3) Human pause

Purpose:
- stop after analysis so the user can choose targets

Input:
- `projects/profesia-scout/YYYY-MM-DD/report.md`

Output:
- explicit selected companies/roles for follow-up

Hard rule:
- Do **not** start research or writing for all matches automatically.
- If the user has not selected targets, summarize the report briefly and ask which companies should move forward.

### 4) Researcher — Pulsar

Purpose:
- produce factual company research only for user-selected targets

Primary inputs:
- `projects/profesia-scout/YYYY-MM-DD/report.md`
- selected companies
- `projects/profesia-scout/prompts/researcher.md`
- `projects/profesia-scout/config/workflow-state.json`

Expected outputs:
- `projects/profesia-scout/YYYY-MM-DD/{company-slug}/company-research.md`
- updated researcher counts/status in workflow state

Rules:
- Research only selected companies
- Prefer official sites and straightforward web sources
- If a fact cannot be verified, write `Data unavailable`
- Keep research factual and compact

Necessity:
- Researcher is **optional**. Use it when the user wants higher-quality targeting, stronger company-specific openings, or a more competitive application.
- It can be skipped in reduced mode.

### 5) Writer — Lumina

Purpose:
- draft cover letters for selected targets, usually using company research and the correct CV variant

Primary inputs:
- `projects/profesia-scout/YYYY-MM-DD/report.md`
- optional `projects/profesia-scout/YYYY-MM-DD/{company-slug}/company-research.md`
- relevant CV from `projects/profesia-scout/cv/`
- `projects/profesia-scout/prompts/writer.md`
- `projects/profesia-scout/config/workflow-state.json`

Expected outputs:
- `projects/profesia-scout/YYYY-MM-DD/{company-slug}/cover-letter.md`
- updated writer counts/status in workflow state

CV routing from the current writer prompt:
- ERP domain → `cv_erp_consultant.md`
- Data/BI domain → `cv_data_analyst.md`
- junior/support sysadmin or IT support → `cv_sysadmin.md`
- junior-entry DevOps/cloud → `cv_sysadmin.md`
- General IT/Other → `cv_systems_analyst.md`

Writer constraints to preserve:
- Every fact must be traceable to source files
- No invented metrics, years, tooling depth, scale, or company claims
- Do not present the user as medior/senior in infra, DevOps, data, or security unless source files justify it
- ERP / manufacturing-process / JD Edwards support can be written more confidently when the role is genuinely close
- English output should stay clear, simple, B2-level

Necessity:
- Writer is **optional as a dedicated specialist agent**. Cover-letter generation is needed only if the user wants application drafts. In reduced mode, a simpler generic letter can be produced without a full Lumina-style custom pass.

## Full mode vs reduced mode

### Full mode
Use when:
- the target is promising and worth a real application
- the user wants higher-quality customization
- company-specific context matters
- the role is competitive or close to the user's strongest domains

Flow:
- analyzer → human pause → researcher → writer

### Reduced mode
Use when:
- the user wants speed / volume
- the role is only moderately attractive
- company research adds little value
- a generic but truthful application is enough
- the job is standardized and the main differentiator is baseline fit, not bespoke company insight

Reduced-mode options:
1. **Skip research, keep writing**
   - writer uses report + correct CV + job ad only
   - no company-specific claims beyond verified basics already present in source files
2. **Skip research and custom writer style**
   - generate a compact generic cover letter template tailored only by domain and CV
   - safest for medium-fit roles or batch applications

Constraints in reduced mode:
- keep letters factual and reusable
- avoid fake personalization
- do not mention company facts unless verified
- still choose the correct CV variant

## Language-switchable cover letters

Cover letters may be generated in `SK` or `EN`.

### English mode
- follow the current writer prompt's B2-English constraint
- short, direct sentences
- no polished-native marketing tone

### Slovak mode
- keep the same factual constraints and seniority honesty
- write plainly and professionally in Slovak
- do not translate technical products/company names unless that is the natural Slovak form already used in the source
- preserve the same confidence calibration: strong for ERP/process-support fit, careful/junior-transition wording elsewhere

Language rule:
- if the user specifies `SK` or `EN`, use it
- when spawning the writer, pass that choice explicitly as `language=sk` or `language=en`
- if the job ad language clearly implies one language and the user did not override it, convert that decision into an explicit writer input (`language=sk` or `language=en`), not an implicit default
- if unclear, ask only if the letter is actually being drafted now; otherwise note that language can be switched later

## Recommended execution order

1. Resolve target date.
2. Read `workflow-state.json`.
3. Inspect the date folder for today's cron-produced outputs.
4. If scrape data is missing or invalid, stop and report the prerequisite failure unless the user explicitly wants recovery.
5. Read the phase prompt/source files relevant to the next pending step.
6. If spawning a dedicated phase worker, use `sessions_spawn` and explicitly instruct that worker to read/execute its phase prompt file.
7. Run only the next pending interactive phase unless the user asked for a rerun or a specific phase.
8. After analysis, stop for the user's target selection.
9. If the user wants full mode, run research then writing.
10. If the user wants reduced mode, skip research and/or custom writer step as requested.
11. Keep workflow state consistent with actual files produced.

## What to generate

Depending on request:
- pipeline status summary from `workflow-state.json`
- daily report summary from `report.md`
- missing `report.md` for a date that already has cron-produced `descriptions.json`
- per-company `company-research.md`
- per-company `cover-letter.md`
- reduced-mode generic cover letters for selected targets

When summarizing to the user, keep it decision-focused:
- counts of strong/potential/filtered
- best targets
- main blockers/caveats
- explicit request for company selection if needed

## What not to do

- Do not create a parallel workflow outside `projects/profesia-scout`
- Do not revive stale path layouts from older notes/examples
- Do not assume one monolithic agent identity for all phases
- Do not add a `references/` orchestration directory; keep logic here in this skill and in the live project files
- Do not research or draft for unselected companies automatically after analysis
- Do not require company research when reduced mode is enough for the user's goal
- Do not inflate the user's seniority or claim unverified platform experience
- Do not fabricate company facts, job requirements, or CV achievements
- Do not edit `applications.json`, `seen-offers.json`, `blacklist.json`, or `workflow-state.json` casually; update them only when that phase actually ran and the state matches produced outputs

## Fast checklist

Before acting:
- [ ] date identified
- [ ] state file checked
- [ ] existing outputs for that date checked
- [ ] correct project root confirmed: `projects/profesia-scout`
- [ ] relevant prompt/source files for the phase read
- [ ] Axiom/Pulsar/Lumina treated as separate role workers, not one fake identity
- [ ] cron-produced scrape data exists or the prerequisite failure is reported cleanly
- [ ] human pause respected between analysis and downstream steps
- [ ] full mode vs reduced mode chosen appropriately
- [ ] cover-letter language set or deferred sensibly
- [ ] no unverified claims in research or writing
