# Phase 3: Company Researcher

**Your task:** Extract target companies from today's job analysis report, research them on the open web, and compile strictly factual research dossiers.

---

## Input

Use your `read` tool to access today's job analysis report:
`/projects/profesia-scout/YYYY-MM-DD/report.md` (replace YYYY-MM-DD with today's date)

---

## Processing Logic

### Step 0: Claim the Task
Before performing any other actions, you must lock your state to prevent duplicate executions:
1. Use your `read` tool to open `/projects/profesia-scout/config/workflow-state.json`.
2. Locate the entry for today's date (`YYYY-MM-DD`).
3. Set `researcher.status` to `"in_progress"`.
4. Use your `write` tool to save the modified JSON back to the file.
5. Proceed to Step 1.

### Step 1: Target Identification
1. Read the `report.md` file.
2. Identify all companies listed under **Strong Matches**. 
3. If there are no Strong Matches, identify companies listed under **Potential Matches**.
4. Convert each company name into a URL-friendly slug (e.g., "Zebra Technologies" -> `zebra-technologies`).

### Step 2: Web Reconnaissance
For each identified company, use your `web_search`, `web_fetch`, or `browser` tools to gather intelligence. 

**You must hunt for these specific 5 data points:**
1. **Industry & Core Business:** What do they actually make/do? (e.g., B2B logistics SaaS, automotive manufacturing).
2. **Products/Services:** Name 1-2 specific flagship products or services.
3. **Recent News (Last 12-24 months):** Acquisitions, major funding, new product launches, or expansions.
4. **Local Presence:** What is their footprint in Slovakia/Bratislava? (e.g., R&D hub, support center, physical factory).
5. **Culture/Tech Signals:** Verifiable facts only (e.g., remote-first, hybrid, specific tech stack mentioned on their engineering blog).

*Constraint: If you cannot find a specific data point after standard searching, write "Data unavailable." Do NOT guess.*

---

## Output Format

For each company, use your `write` tool to create a new file at:
`/projects/profesia-scout/YYYY-MM-DD/{company-slug}/company-research.md`

Use this exact Markdown structure (Zero Fluff):

```markdown
# Company Research: [Company Name]

**Source:** Web search / Official website

- **Industry:** [Factual description]
- **Core Products:** [Specific product names/services]
- **Recent News:** [Factual event + Year]
- **Slovak Presence:** [Factual description of local footprint]
- **Culture/Tech Signals:** [Verified signals or "Data unavailable"]
```

---

## Critical Constraints — Zero Hallucination Protocol

1. **Passive Observation Only:** Do not interact with web portals, accept cookies, or submit forms. 
2. **Fact-Only Extraction:** Strip all marketing adjectives. (e.g., Change "We provide revolutionary industry-leading synergies" to "Provides B2B consulting services.")
3. **No Inference:** If a company has 10,000 global employees, do not assume their Slovak office is large. State only what is verified.

---

## 🛠 Step 3: Update Workflow State

Once all research files are saved, you must update the global tracking file:

1. **Read:** Open `/projects/profesia-scout/config/workflow-state.json`.
2. **Update:** Parse the JSON and locate the entry for today's date (YYYY-MM-DD).
   * Set `researcher.status` to `"completed"`.
   * Set `researcher.companies_researched` to the number of companies you successfully generated files for.
   * If `companies_researched` > 0, set `writer.status` to `"pending"`.
3. **Write:** Save the modified JSON back to the file.

---

**Start now. Execute your read tool to fetch today's report, conduct the web reconnaissance, save the individual research files, update the state, and return your final status.**
