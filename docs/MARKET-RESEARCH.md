# Market research: existing alternatives and positioning

*Researched November 2026 for a portfolio project. Prices and features come from public
pages and third-party comparisons; they change often and were not tested hands-on.*

## 1. Short answer

The technology in this project (read-only Workspace audit, risk score, plain-language fixes) **already
exists**, including free options. A product built only on "simple, in Spanish, with recommendations"
would not stand out. The realistic gap is a **niche plus a service**: small, Spanish-speaking businesses
in regulated industries (auto dealers, insurance agencies) that need **proof** that fixes were made, not
just a list of advice.

## 2. Google Workspace security checkers

| Tool | What it does | Published price | Source |
|---|---|---|---|
| **Google Security Advisor** (built into Workspace) | Recommends settings such as 2-Step Verification and limiting external Drive sharing; periodic tips. Available in Spanish. | Included in Business Starter, Standard and Plus | Google Workspace Admin Help* |
| **Overdrive** | Read-only scan; prioritizes public links, external access, third-party apps and account risks; mark access as intentional; daily Drive permission checks on paid plan. | First scan free; about US$390/year up to 10 users | [workspace.overdrive.tools](https://workspace.overdrive.tools/) |
| **Esmeris** | Read-only audit, A–F grade, findings by severity, plain-English steps; focus on who keeps access. | 3 findings free; full price not published | [esmeris.com](https://esmeris.com)* |
| **ArgusSec** | Audit + AI remediation plans with links to Google Admin; scheduled scans and alerts when an issue returns. | First audit free; about €15/month | [Google Workspace Marketplace](https://workspace.google.com/marketplace/app/argussec/133488094837) |
| **Workspace Audit (AppsEDU)** | Direct links to settings, scheduled scans, history, fixed issues and accepted exceptions. | One free scan; about US$600/year for 100 users | [workspaceaudit.com/pricing](https://workspaceaudit.com/pricing) |

\* Reported in a peer review of this project (ChatGPT, Nov 2026); not independently verified.

**Takeaway:** re-scanning, progress history, accepted exceptions and links to Google Admin are table stakes.

## 3. Regulated niche: auto dealers and the FTC Safeguards Rule

### What the rule is
The **FTC Safeguards Rule** (16 CFR Part 314, under the Gramm-Leach-Bliley Act) requires covered non-bank
"financial institutions" to run a written information security program. The rule's own examples include
an automobile dealership with respect to its **leasing** business (§ 314.2(h)(2)(ii)); dealer associations
(NADA) and FTC dealer guidance treat dealerships that arrange **financing or leasing** as covered.

### What it requires (§ 314.4, per the FTC's business guide)
| § | Requirement |
|---|---|
| (a) | A **Qualified Individual** who runs the program (can be a vendor; the dealer stays responsible) |
| (b) | Written **risk assessment** |
| (c)(1) | **Access controls** — periodically review who needs access |
| (c)(2) | Inventory of data and systems |
| (c)(3) | **Encryption** at rest and in transit (or approved alternatives) |
| (c)(4) | Assess the security of apps you use |
| (c)(5) | **Multi-factor authentication** for anyone accessing customer information |
| (c)(6) | Secure **disposal** (generally within 2 years of last use) |
| (c)(7) | Change management |
| (c)(8) | **Log authorized users' activity** and detect unauthorized access |
| (d) | Continuous monitoring, or annual penetration test + vulnerability scans every 6 months |
| (e) | Security awareness **training** |
| (f) | **Service provider** oversight |
| (g) | Keep the program current |
| (h) | Written **incident response plan** |
| (i) | Annual written report to the board / owner |
| (j) | **Notify the FTC** within 30 days of a breach affecting 500+ consumers (unencrypted data) |

**Small-business relief (§ 314.6):** institutions with customer information on **fewer than 5,000
consumers** are exempt only from (b)(1), (d)(2), (h) and (i). Every other element still applies,
including MFA and the FTC notification. Dealer groups note that CRM and website leads count toward the
5,000, so few dealers qualify.

**Enforcement (as of Nov 2026):** no public FTC Safeguards Rule case against a dealer was found; recent FTC
dealer actions focused on pricing and add-ons. Breach notifications to the FTC are published.

### How this project maps to the rule
| Rule element | This app (Stage 1) |
|---|---|
| (c)(5) MFA | ✅ Detects admins and users without 2-Step Verification, verifies the fix on the next check |
| (c)(1) Access controls | ✅ Partial: super admin count, inactive accounts, public files |
| (f) / (c)(4) Third parties and apps | ✅ Partial: third-party apps with broad Gmail/Drive/Admin access |
| (c)(8) Activity logging | ⏳ Stage 2 (Alert Center / audit logs) |
| (c)(3) Encryption, (c)(6) disposal, (d) pen testing, (e) training, (h) incident plan, (j) notification | ❌ Out of scope |
| Evidence for (i) annual report | 💡 Possible: dated history of checks, pending → fixed, accepted exceptions |

**Conclusion:** the app covers a few technical controls inside Google Workspace. It is a **supporting
tool**, not a compliance program, and must not be marketed as "Safeguards compliant".

### Dealer compliance competitors
| Vendor | Positioning | Price (reported) |
|---|---|---|
| **ComplyAuto** | Full dealer compliance suite: Safeguards, privacy, vulnerability scans, annual pen test, board-report wizard | From about $99/rooftop/month to about $1,000/store/month for bundles; varies by source |
| **KPA / ComplyNet** | Guided 10-step compliance framework | Quote only |
| **DealSafe**, **Mosaic**, **700Credit**, **Dealertrack Compliance** | Safeguards programs or add-ons | Varies |

Sources: [ComplyAuto](https://complyauto.com/ftc-safeguards/), [ComplyAuto pricing comparison](https://complies.ai/blog/complyauto-pricing),
[2026 dealer compliance software comparison](https://www.dealsafe.com/resources/best-dealer-compliance-software-compared-for-2026-safeguards-red-flags-training-and-proof),
[ComplyAuto vs. ComplyNet](https://captaincompliance.com/education/complyauto-vs-complynet-a-dealers-guide-to-choosing-compliance-platform/).

**Takeaway:** franchise dealers already buy full suites. The open space is **small independent and
used-car dealers** that find these suites expensive and complex, and that run on Google Workspace with
no IT staff — often Spanish-speaking in South Florida.

## 4. Where this project could be different

1. **Niche:** small independent dealers and insurance agencies in South Florida, bilingual.
2. **Verification, not advice:** "pending → fixed, confirmed by a new check" plus a dated history that can
   be attached to an annual report or a cyber-insurance application.
3. **Done-with-you service:** a bilingual person helps fix it (call/WhatsApp). Competitors are self-serve software.
4. **Channel:** sold through insurance agencies, accountants or local IT providers who already serve these businesses.
5. **Monthly "what changed" view:** new since last check, still pending, verified fixed.

## 5. What has to be true (validation before building more)

- Talk to **3 owners or managers** (a small dealer, an insurance agency, one other SMB).
- Test the same scenario against **Google Security Advisor** and **Overdrive**.
- Ask: Can they find what to fix first? Where to fix it? How would they know it's done?
  **Would they pay ~$50/month to repeat it next month?**
- Continue only if at least 2 of 3 show real interest and Google's free tool isn't enough for them.

## Sources (rule)
- [16 CFR 314.2 — definitions and examples (Cornell LII)](https://www.law.cornell.edu/cfr/text/16/314.2)
- [16 CFR 314.6 — exceptions (Cornell LII)](https://www.law.cornell.edu/cfr/text/16/314.6)
- [FTC: Safeguards Rule — What Your Business Needs to Know](https://www.ftc.gov/business-guidance/resources/ftc-safeguards-rule-what-your-business-needs-know)
- [NADA: A Dealer Guide to the FTC Safeguards Rule](https://www.nada.org/nada/education-consulting/driven-management-guide/dealer-guide-ftc-safeguards-rule-l43)
- [Small dealerships and the 5,000-consumer exception (ComplyAuto)](https://complyauto.com/even-the-smallest-dealerships-need-to-comply-with-the-ftc-safeguards-rule/)
- [Breach notification guide](https://heliontechnologies.com/safeguards-rule-breach-notification/)

*This document is product research, not legal advice.*
