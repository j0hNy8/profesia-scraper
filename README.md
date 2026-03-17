# profesia-scraper
Zero-LLM job scraper for Profesia.sk. Uses CDP to bypass bot detection, apply keyword filters, and trigger AI agent pipelines.

# Profesia Scout (OpenClaw CDP Scraper)

A zero-LLM-token Node.js scraper that connects to an OpenClaw-managed browser profile via the Chrome DevTools Protocol (CDP). It extracts job listings and full descriptions from Profesia.sk, filtering out blacklisted companies and irrelevant roles.

## Features
- **CDP Automation:** Bypasses basic bot detection by driving a real OpenClaw browser.
- **State Management:** Tracks previously seen offers to avoid scraping duplicates.
- **Auto-Boot:** Automatically starts the OpenClaw browser profile if it isn't running.
- **Pipeline Ready:** Updates a `workflow-state.json` file to trigger downstream AI agents (Analyzer, Researcher, Writer).

## Prerequisites
- Node.js (v18+)
- [OpenClaw](https://github.com/example/openclaw) installed and configured.

## Usage
1. Clone the repository.
2. Install dependencies: `npm install ws`
3. Run the scraper: `node scraper.js`

Outputs are saved in a date-stamped folder (e.g., `workspace/projects/profesia-scout/YYYY-MM-DD/descriptions.json`).
