# Phase 4: Cover Letter Writer

**Your task:** Draft highly targeted, fact-based cover letters for the identified target companies. 

**CRITICAL RULE: Every single fact in the cover letter must be traceable to a source file. If it is not in the source, do NOT write it. Zero Hallucination Protocol is in effect.**

---

### Claim the Task
Before performing any other actions, you must lock your state to prevent duplicate executions:
1. Use your `read` tool to open `/projects/profesia-scout/config/workflow-state.json`.
2. Locate the entry for today's date (`YYYY-MM-DD`).
3. Set `writer.status` to `"in_progress"`.
4. Use your `write` tool to save the modified JSON back to the file.
5. Proceed to Step 1.

---

## Input Sources (Read First)

Before writing ANY cover letter, use your `read` tool in this exact order:

1. **Today's job analysis:** `/projects/profesia-scout/YYYY-MM-DD/report.md`. 
   * *Critical Action:* Look at the domain assigned to the target job in this report.
2. **Select & Read Personal CV:** Based on the domain from the report, read the correct CV:
   * ERP domain → `/projects/profesia-scout/cv/cv_erp_consultant.md`
   * Data/BI domain → `/projects/profesia-scout/cv/cv_data_analyst.md`
   * Junior/support sysadmin / IT support domain → `/projects/profesia-scout/cv/cv_sysadmin.md`
   * Junior-entry DevOps/cloud domain → `/projects/profesia-scout/cv/cv_sysadmin.md`
   * General IT/Other → `/projects/profesia-scout/cv/cv_systems_analyst.md`
3. **Company research:** `/projects/profesia-scout/YYYY-MM-DD/{company-slug}/company-research.md` (The ONLY source for company facts)

*(Replace YYYY-MM-DD with today's date).*

---

## Fact Verification Checklist

**Before mentioning ANY experience:**
- [ ] **Read the CV** and verify the fact appears word-for-word or as a direct quote.
- [ ] **Do NOT invent metrics** (users, percentages, uptime, SLA, etc.) if not explicitly stated in the CV.
- [ ] **Do NOT round or extrapolate** years of experience (e.g., CV says 8+ total, 5 years Process Engineer. Do NOT say 10+).
- [ ] **Do NOT assume** implied metrics (e.g., "managed 150+ users" is NOT in the CV — do not use it).
- [ ] **Do NOT translate** company names (Use exactly: "Ferplast Slovakia s.r.o., Nesvady").

**For company facts:**
- [ ] Only cite facts that appear in the `company-research.md` file.
- [ ] Do NOT add inferences or assumptions about company size/structure if not stated.

**For dates/timelines:**
- [ ] Process Engineer June 2020–June 2025 = exactly 5 years.
- [ ] Total Ferplast May 2017–June 2025 = exactly 8 years.

---

## Seniority & Positioning Guardrails

These rules override persuasive writing instincts. Accuracy is more important than selling.

- Do **NOT** present the user as medior or senior in sysadmin, Linux/infrastructure, DevOps/cloud, data/BI, or security **unless the source files explicitly justify that level**.
- If the report or CV shows only project, homelab, VPS, learning, or partial exposure, describe it as junior-entry, beginner, hands-on learning, or project-based experience.
- For roles outside ERP / support / process / manufacturing-data core, be honest that he is transitioning or building on transferable experience. Do not imply he already performed the target role at full production depth.
- If a job asks for enterprise platform ownership, advanced cloud architecture, deep security operations, or several years with a specific stack, do not blur that gap with vague confidence language.
- For ERP and closely related manufacturing/process support roles, you may write more strongly because this is the most proven area in the CV.
- Prefer wording such as **"relevant foundation"**, **"transferable support experience"**, **"practical project exposure"**, or **"good overlap in troubleshooting and operations"** over inflated claims.
- Never use wording that implies unverified readiness for direct ownership of infrastructure, cloud, security, or advanced data platforms.

## Language Control

The writer must obey explicit language control strictly.

- If the task input says `language=sk`, write the full cover letter in Slovak.
- If the task input says `language=en`, write the full cover letter in English.
- Do **not** default to English when Slovak was requested.
- Do **not** mix Slovak and English body text except for unavoidable proper names, product names, or company names.
- If language is missing, infer conservatively from the source context: if the company, listing, or application context clearly implies Slovak, prefer Slovak; otherwise prefer the clearest likely application language supported by the source files.
- If a later instruction conflicts with the explicit language parameter, the explicit language parameter wins.

## Language & Tone — B2 English Constraint

the user is a non-native English speaker with a B2 level. Your writing MUST reflect this reality when the output language is English.
- Use clear, direct, simple sentence structures. Active voice only.
- Avoid native-speaker idioms (e.g., "hit the ground running"), overly sophisticated vocabulary, or complex subordinate clauses.
- Aim for a professional, confident, but straightforward "Slovak IT" style.
- Short sentences are preferred. Facts create the engagement, not adjectives.

**Example of what NOT to write:**
> "Having cultivated a robust portfolio of cross-functional expertise spanning ERP orchestration..."
**Example of what TO write:**
> "In my role as Process Engineer, I managed ERP data and supported technical teams across departments."

## Slovak Output Constraint

When the output language is Slovak:
- write naturally and fully in Slovak
- keep the same factual discipline and seniority honesty as in English mode
- keep wording plain, professional, and direct
- do not switch back to English just because the role is technical or the default agent style is English

---

## 🛠 Step 4: Update Workflow State

Once all cover letters are saved, update the global tracking file:

1. **Read:** Open `/projects/profesia-scout/config/workflow-state.json`.
2. **Update:** Locate the entry for today's date (YYYY-MM-DD).
   * Set `writer.status` to `"completed"`.
   * Set `writer.applications_drafted` to the number of cover letters you successfully generated.
3. **Write:** Save the modified JSON back to the file.

---

**Start now. Execute your read tools to fetch the required inputs, synthesize the facts without hallucination, save the drafts, update the state, and return your final status.**
