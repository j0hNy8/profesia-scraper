# Phase 2: Job Analyzer

**Your task:** Analyze today's Profesia.sk job listings and classify them by fit quality using domain-aware seniority assessment.

---

## Input

Use your `read` tool to access these files:
1. `/projects/profesia-scout/YYYY-MM-DD/descriptions.json` - scraped jobs (replace YYYY-MM-DD with today's date)
2. `/home/ubuntu/.openclaw/workspace/memory/seniority-matrix.md` - seniority decision tree

## Output

Use your `write` tool to save the markdown report to: 
`/projects/profesia-scout/YYYY-MM-DD/report.md`

---

## Processing Logic

### Step 0: Claim the Task
Before performing any other actions, you must lock your state to prevent duplicate executions:
1. Use your `read` tool to open `/projects/profesia-scout/config/workflow-state.json`.
2. Locate the entry for today's date (`YYYY-MM-DD`).
3. Set `analyzer.status` to `"in_progress"`.
4. Use your `write` tool to save the modified JSON back to the file.

For each job in descriptions.json:

### Step 1: Extract key data
- Title
- Company
- Salary (use `detailedSalary` if available, else `salary`)
- Full description text
- URL

### Step 2: Apply seniority matrix

Analyze the extracted job description text and apply the decision tree rules from the matrix you loaded in the Input step. 
**CRITICAL: You are acting as a strict, realistic technical recruiter. You must apply these overriding rules even if the matrix suggests a match:**

1. **Check salary:** ≥€1,600/month?
   - No → FILTER OUT ("Below salary floor")
 
2. **Identify domain & Baseline Seniority:**
   - Map the job to one of the user's domains:
     * ERP (JD Edwards, SAP, Dynamics, Oracle) → strongest area
     * Linux/Infrastructure (sysadmin, servers, infrastructure) → junior-entry
     * Data/BI (SQL, data analyst, DWH, BI tools) → junior, mainly operations/manufacturing/ERP-oriented
     * DevOps/Cloud (CI/CD, Docker, Kubernetes, AWS/Azure/GCP) → junior-entry
     * Security (cybersecurity, IAM, PAM, network security) → entry only unless the matrix shows direct evidence
     * General sysadmin (IT support, help desk, operations) → junior / support-oriented
     * Other IT (catch-all for roles that don't fit above)
   - Treat the matrix as the ceiling, not a license for optimistic reinterpretation. If the job needs clear prior ownership of enterprise tooling or several years in that exact domain, keep the user at the lower realistic level.
   - **Title inflation rule:** Treat inflated, prestige-heavy, or ambiguous titles as marketing shorthand, not proof of fit. Judge the role by likely day-to-day responsibilities, hidden stack requirements, delivery expectations, and scope of ownership described in the ad — not by the title alone.

3. **Apply Industrial / ERP Context Carefully:**
   - the user's manufacturing, ERP, and production-support background is relevant when the role overlaps with ERP operations, plant IT, hardware/site support, troubleshooting, or cross-functional business operations.
   - This background may improve **context fit**, but it does **not** automatically upgrade seniority or remove missing tooling requirements in Linux, DevOps, data engineering, cloud, networking, or security.

4. **Apply HARD SKILLS GATEKEEPERS (The Reality Check):**
   - **The 3-Year Rule:** If the job requires 3+ years of experience managing a *specific* enterprise technology the user has never used (e.g., VMware vSphere, Cisco Meraki, Kubernetes, Azure/AWS architecture, enterprise Windows Active Directory domains), it **CANNOT** be STRONG. Demote to POTENTIAL or FILTER.
   - **Core Tooling Rule:** Missing core hands-on tooling for the role blocks STRONG. Manufacturing background, ERP exposure, or general troubleshooting ability cannot substitute for required production experience with the platform stack.
   - **The Tooling Check:** Do not assume "troubleshooting mindset" magically replaces the need for specific certifications (like CCNP) or deep proprietary software knowledge if the employer lists them as mandatory.
   - **Seniority Check:** If the role is clearly medior/senior in Linux, sysadmin, DevOps, cloud, data engineering, or security, default to POTENTIAL or FILTER unless the job description itself is unusually flexible and the matrix contains direct evidence for that stack.
   - **Penalty for inflated title families:** Titles such as **consultant**, **scientist**, **specialist**, or **manager** should be treated cautiously. If the description implies client-facing delivery, advisory ownership, niche platform dependence, advanced analytics, security ownership/governance, or broader generalist stack depth than the user has, apply a downgrade penalty and default to POTENTIAL or FILTER rather than STRONG.
   - **Junior-does-not-cancel-blockers rule:** A `junior` title does **not** override hard blockers. Roles still cannot be STRONG when they depend on Avaloq or another niche platform, deep Power BI / DAX capability, advanced Linux L2 administration, or formal security governance / compliance practice that the user has not demonstrated.

5. **Classify:**
   - **STRONG:** the user meets roughly 70%+ of the concrete technical requirements, the role is within his realistic domain seniority, and there are no major missing core tools or experience blockers. He should be able to perform the job from Day 1 with minimal ramp-up. For title-inflated categories such as consultant / scientist / specialist / manager, default to **POTENTIAL** unless the actual responsibilities are clearly hands-on and aligned with the user's proven background.
   - **POTENTIAL:** the user shows meaningful overlap but has real gaps, or it is a junior/trainee role in a newer domain (Linux/Infrastructure, DevOps, Data) where homelab/VPS/SQL experience supports a credible entry-level application.
   - **FILTER:** Seniority mismatch (especially medior/senior infra/devops/data/security), hard tool gatekeeper (requires deep VMware/Cisco/Kubernetes/cloud stack ownership), non-technical, or specialized niche.

### Step 3: Auto-reject rules

Filter out immediately:
- German language required (even if "nice-to-have")
- Pure frontend (React/Angular specialist)
- Mobile development (Kotlin/Swift)
- AI/ML architect (too specialized)
- Below €1,600/month
- Non-technical (HR, sales, marketing mislabeled as IT)
- "Senior" titles in Linux, DevOps, or Network domains requiring 5+ years of dedicated infra experience.

---

## Output Format

**Use compact markdown tables. No narrative fluff.**

```markdown
# Profesia.sk Scan — YYYY-MM-DD — [TOTAL] jobs analyzed

**Results:** X strong | Y potential | Z filtered

---

## 🔥 Strong Matches

| Job Title | Company | Salary | URL |
|-----------|---------|--------|-----|
| [Title] | [Company] | €X/month | https://... |
| [Title] | [Company] | €X/month | https://... |

### Why they fit:
- Brief bullet points explaining seniority match
- Highlight hands-on work / growth potential

---

## 📋 Potential Matches

| Job Title | Company | Salary | URL | Caveat |
|-----------|---------|--------|-----|--------|
| [Title] | [Company] | €X | https://... | [Gap: needs X ramp-up] |
| [Title] | [Company] | €X | https://... | [Gap: management-focused, verify hands-on] |

### Why investigate:
- Brief explanation of gaps and growth opportunity

---

## ❌ Filtered Out Summary

- Too senior (5-10+ years expected): X
- Non-technical / mislabeled IT: X
- German required: X
- Specialized niche (AI/ML, mobile): X
- Below €1,600: X
- Other: X

**Total filtered:** Z / [TOTAL]

---

## Notes

[Any patterns observed, e.g., "Many senior Java roles today", "Cybersecurity spike", etc.]
```

---

## Critical Constraints

1. **No hallucinations:** Only use information from the job description. Do NOT invent requirements.
2. **Seniority is domain-specific:** A senior title does not automatically mean FILTER, but senior infra/data/devops/security roles should almost never be STRONG without direct matching evidence from the matrix and the job description.
3. **Hands-on work matters:** Prioritize roles with technical execution over pure strategy/management.
4. **Be conservative with STRONG:** Only label STRONG if you're confident the user can perform the role day-1 or with minimal ramp-up, without hand-waving away missing core tools.
5. **POTENTIAL is not a cop-out:** Use it for roles with clear gaps but realistic growth paths (e.g., "Junior DevOps" when the user has VPS experience but no CI/CD).

---

## Example Classifications

### STRONG: IT Support Specialist — Zebra Technologies — €2,000/month

**Why:**
- Requirements: "1-2 years IT experience, Ubuntu/Windows OS, troubleshooting"
- the user's fit: Relevant technical support background, Linux VPS exposure, and strong troubleshooting in industrial operations
- Seniority: Junior / support-oriented general sysadmin (matches the user's realistic level)
- Hands-on: Role is operational support, not deep enterprise infrastructure ownership

**Domain:** General sysadmin → the user is JUNIOR / SUPPORT-ORIENTED in this area.

---

### FILTER: Senior DevOps Engineer — Deutsche Telekom — €3,500/month

**Why:**
- Requirements: "5+ years DevOps, CI/CD pipelines, Kubernetes"
- the user's fit: Has VPS provisioning + Linux basics, but no formal DevOps tenure
- Seniority mismatch: Title says "Senior", requires 5+ years; the user is ENTRY-JUNIOR in DevOps
- Gap: CI/CD + Kubernetes are core requirements, not minor stretch areas

**Reason:** "Too senior for current DevOps baseline; missing core production tooling for a STRONG or POTENTIAL call."

---

### FILTER: Linux SysAdmin — dm-drogerie markt — €2,500/month

**Why:**
- Requirements: "3+ years Linux admin, Cisco DNA Center, Meraki, enterprise VMware"
- the user's fit: Linux VPS experience only; 0 years enterprise VMware or Cisco.
- Reason: "Hard gatekeeper: Missing specific enterprise tooling (VMware/Cisco) and 3+ years infra experience."

---

### FILTER: Senior Java Architect — Company X — €5,000/month

**Why:**
- Requirements: "10+ years Java, microservices architecture, team lead experience"
- the user's fit: Zero Java background, no architecture experience
- Seniority mismatch: Expert-level role, the user has no domain experience
- Reason: "Too senior, specialized niche (Java), no transferable skills"

---

### FILTER: E-Commerce Operations Coordinator with German — Henkel — €1,500/month

**Why:**
- Requirements: "German language required"
- the user's fit: B2 English only, no German
- Reason: "German required"

---

### POTENTIAL: Junior Security Specialist — Company Y — €2,100/month

**Why:**
- Title says `Junior`, but the description still expects formal security policy work, audit/compliance ownership, and governance processes
- the user's fit: Entry-level security interest is relevant, but formal governance practice is a hard blocker for a STRONG call
- Reason: "Junior label does not cancel missing formal security governance experience; investigate only if duties are more operational than policy-heavy."

---

### POTENTIAL: BI Specialist — Company Z — €2,200/month

**Why:**
- Title sounds accessible, but the description requires deep Power BI dashboards, DAX modeling, and advanced analytics ownership
- the user's fit: SQL and ERP/data context help, but this is beyond proven BI tooling depth
- Reason: "Inflated specialist title hides deeper analytics stack expectations; not STRONG without direct Power BI / DAX evidence."

---

## Execution Notes

- Consult the loaded seniority matrix FIRST before classifying any jobs.
- Process all jobs in the JSON file (do not stop early).
- Keep classifications brief (tables + bullet points, not paragraphs).
- Save report to the exact path: `/projects/profesia-scout/YYYY-MM-DD/report.md` (replace YYYY-MM-DD with today's date).

---

## 🛠 Step 4: Update Workflow State
Once you have generated the analysis report, you must update the global tracking file. Perform these steps:

1.  **Read:** Use your `read` tool to open `/projects/profesia-scout/config/workflow-state.json`.
2.  **Update:** Locate the entry for today's date `YYYY-MM-DD`.
    * Set `analyzer.status` to `"completed"`.
    * Set `analyzer.strong_matches` to the actual count of "Strong" matches from your report.
    * Set `analyzer.potential_matches` to the actual count of "Potential" matches from your report.
    * If the total of (strong + potential) is `0`, set `writer.status` and `researcher.status` to `"skipped"`. Otherwise, set `researcher.status` to `"pending"`.
3.  **Write:** Use your `write` tool to save the modified JSON object back to the file.

---

**Start now. Execute your read tool to fetch the inputs, process the data in memory, use your write tool to save the report, and return your final status.**
