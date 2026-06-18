# Veloce — Company Formation Roadmap (separate from the product roadmap)

> Status: **for review / working document.** Drafted 2026-06-18. This is the
> path from "idea + two founders" to a functional, fundraise-ready Delaware
> C-corp, given a **US + Canada cross-border founder pair**. It is deliberately
> separate from `ROADMAP.md` (the product/commercialization plan) — formation and
> product proceed in parallel.
>
> **This document is a map, not legal or tax advice.** Items marked **[PRO]** are
> decisions only a qualified professional should make with you. There are more of
> them than in a typical formation because three complications stack (see below).
> External figures verified against primary sources (IRS, FinCEN, Delaware) on
> 2026-06-18; **re-verify before acting** — tax and reporting rules move.

## Why this isn't a simple checklist

A vanilla Delaware C-corp is nearly a checklist. Yours isn't, because three things
stack, and each is a place where a wrong early move is expensive or irreversible:

1. **Cross-border founders (US + Canada).** A US C-corp issuing equity to or
   paying a Canadian resident triggers US withholding, Canadian personal tax on
   the US shares, and US–Canada treaty analysis. This is where "catastrophic tax
   mistakes" happen if done from a template.
2. **You intend to raise.** This forces choices (Delaware C-corp, clean cap table,
   QSBS eligibility, 83(b) timing) a non-fundraising company could skip.
3. **It's regulated-adjacent fintech.** Banking onboarding is slower, and the
   corporate structure may eventually need to house a regulated subsidiary
   depending on how the product roadmap's R-1 classification lands.

**Engage two professionals, in this order, before forming:** (1) a US startup
lawyer or a VC-track formation service for the mechanics; (2) **a cross-border
US/Canada tax advisor, engaged *before* formation, not after** — the
cross-border mistakes are determined by choices made at formation, and they are
the expensive-to-unwind kind.

---

## Phase 0 — Founder decisions (before any entity exists)

Between you and your partner. These cause founder disputes if skipped; settle
them first, in writing.

- [ ] **Equity split.** Each founder's percentage and the basis (capital, time,
      IP, who's full-time). The single most important pre-formation conversation.
- [ ] **Roles, titles, decision rights.** Who's CEO, who controls what, what needs
      mutual consent.
- [ ] **Founder vesting.** Founder shares should vest (typically 4-year, 1-year
      cliff) even for founders — it protects both of you if one leaves. **[PRO]**
      for how vesting interacts with the Canadian founder's tax.
- [ ] **IP assignment — and the Starfysh question.** All existing Veloce work
      (repo, design, brand) must be assigned to the new entity by both founders.
      Today the IP arguably sits with you / Starfysh, since Veloce was built under
      Starfysh. Decide: does Veloce spin out fully separate? Does Starfysh hold
      founder equity? Is there any ongoing relationship? This shapes the cap table
      from day one and is **[PRO]** (legal + tax). **Cheapest to structure
      correctly at formation; expensive to fix once there's a cap table and an
      investor doing diligence.**
- [ ] **The Canadian partner's holding vehicle.** Does your partner hold equity
      personally or through a Canadian holding company? Significant Canadian tax
      consequences. **[PRO]** — a Canadian cross-border accountant decides this.

## Phase 1 — Structural decisions (with professionals)

- [ ] **Entity type & jurisdiction.** Delaware C-corp is the near-default for
      raising US VC — US VCs overwhelmingly require it, and forming as one from
      the start avoids an expensive "flip" later. A non-US parent creates serious
      US-tax complications (Subpart F, PFIC, FIRPTA) if you later raise US money.
      **[PRO]**, but usually Delaware C-corp for this profile.
- [ ] **Do you also need a Canadian entity?** Depends on where your partner works,
      where employees sit, where revenue is earned. The core cross-border
      structuring question; genuinely case-specific. **[PRO]**
- [ ] **Authorized shares & par value.** Standard: ~10M authorized, par value
      $0.0001, ~8M issued to founders, the rest reserved (incl. an option pool).
      These specific numbers minimize Delaware franchise tax.
- [ ] **QSBS eligibility.** Qualified Small Business Stock can exclude a large
      amount of gain from US federal tax on exit; C-corp structure and issuance
      timing affect it. Worth real money. **[PRO]** — and the cross-border angle
      (whether your Canadian partner benefits the same way, likely not) feeds back
      into structure.

## Phase 2 — Formation mechanics (mostly mechanical)

- [ ] File the **Certificate of Incorporation** in Delaware (via Clerky or Stripe
      Atlas — both built for this VC-track profile — or a startup lawyer).
- [ ] Appoint a **Delaware registered agent** (required; bundled with the above).
- [ ] Adopt **bylaws**; hold the **organizational board meeting / consents**;
      appoint officers and directors.
- [ ] **Issue founder stock** via stock purchase agreements, with Phase 0 vesting.
- [ ] **File 83(b) elections within 30 days of the stock grant.** Hard deadline,
      **irreversible if missed.** Matters for both founders; the Canadian
      founder's 83(b) interacts with Canadian tax, so **[PRO]** on whether/when it
      helps them.
- [ ] **Get an EIN** from the IRS. US founders with an SSN can apply online
      instantly. If the responsible party has no SSN/ITIN, file **Form SS-4 by fax
      (~2–4 weeks)** using a foreign passport. Confirm who is listed as responsible
      party (likely you, US-based).

## Phase 3 — Compliance setup (the cross-border traps live here)

- [ ] **Form 5472 + pro-forma 1120** if the company is **25%+ foreign-owned** —
      which your Canadian partner's stake almost certainly makes true. **Penalty
      for missing it is $25,000 per form, per year, even at zero revenue, and it
      cannot be e-filed.** The single most common cross-border-founder surprise.
      Get a CPA who knows it. **[PRO]**
- [ ] **30% US withholding (IRC 1441)** on certain payments (salary, dividends,
      FDAP-type income) to non-US persons — relevant when the company pays your
      Canadian partner. A treaty may reduce it. **[PRO]**
- [ ] **BOI / FinCEN.** As of the **March 2025 interim final rule (still in effect
      2026)**, entities **formed in the US — including a Delaware C-corp with
      foreign owners — are exempt** from Beneficial Ownership Information
      reporting; only foreign-formed entities registered to do business in the US
      must file. **This is an interim rule FinCEN has stated it intends to
      finalize and could change — verify at formation time on FinCEN.gov.** Don't
      rely on this paragraph as evergreen.
- [ ] **Delaware franchise tax + annual report**, due **March 1**, **~$400 min**
      (assumed-par-value method). Late filing penalty + interest.
- [ ] **Form 1120** federal corporate return, due **April 15**, even at zero
      revenue.
- [ ] **Canadian-side filings** for your partner and any Canadian entity. Entirely
      outside US guidance. **[PRO]**

## Phase 4 — Operational setup

- [ ] **Business bank account** — harder/slower for fintech; **start early.**
      Mercury and Brex are the usual startup choices.
- [ ] **Cap table management** — Carta or Pulley from day one. Not a spreadsheet,
      once there are two founders and a pending raise.
- [ ] **Accounting/bookkeeping** — a startup firm that handles cross-border (the
      5472, withholding, coordination with the Canadian accountant).
- [ ] **Founders' / shareholders' agreement** capturing Phase 0 in binding form.
- [ ] **IP assignment agreements** executed by both founders, transferring all
      prior Veloce work into the company. (Pairs with the Phase 0 Starfysh
      decision.)

---

## The [PRO] decision list — bring this to your advisors

Hand this directly to the lawyer and the cross-border accountant. These are the
decisions this document deliberately does **not** answer.

**For the cross-border US/Canada tax advisor (engage first):**
1. Should the Canadian partner hold equity personally or via a Canadian holding
   company? (Phase 0)
2. Does the structure need a Canadian entity in addition to the US C-corp, and if
   so, parent or subsidiary? (Phase 1)
3. How does founder vesting + the 83(b) election interact with Canadian personal
   tax for the Canadian founder — does 83(b) even help them? (Phase 0/2)
4. QSBS: how to preserve eligibility, and what the Canadian founder can/can't
   benefit from. (Phase 1)
5. Form 5472 / 1120 / withholding obligations and who handles the filings. (Phase 3)
6. Canadian-side filing obligations for the partner and any Canadian entity. (Phase 3)
7. The Starfysh → Veloce IP transfer as a tax event — how to structure it cleanly. (Phase 0)

**For the US startup lawyer:**
1. Delaware C-corp vs. alternative for this fundraise + cross-border profile. (Phase 1)
2. The Starfysh → Veloce IP assignment as a legal matter — current ownership and
   clean transfer into the new entity. (Phase 0/4)
3. Cap structure: authorized shares, par value, founder allocations, option pool. (Phase 1)
4. Founder/shareholder agreement and vesting terms. (Phase 0/4)
5. Whether the eventual regulated-entity question (product roadmap R-1) should
   shape the corporate structure now or later. (Phase 1)

## Sequence & parallelism

Formation runs **in parallel with the product build**, but has its own internal
ordering:

1. **Phase 0 first, between the two founders** — equity, IP, the Starfysh
   question, the partner's holding vehicle. No professional can structure around
   decisions you haven't made.
2. **Engage the cross-border tax advisor before forming**, then the lawyer. The
   tax structure informs the legal formation, not the reverse.
3. **Phases 2–4 are then largely mechanical** once 0–1 are settled.
4. **The one item that ties back to the product roadmap:** whether Veloce may
   become a regulated entity (product `ROADMAP.md` R-1) can influence the
   corporate structure. Flag it to the lawyer in Phase 1, but don't let it block
   formation — it can usually be accommodated later.

## Verified figures (as of 2026-06-18; re-verify before acting)

- Form 5472 penalty: **$25,000 per form, per year** (IRS); applies to 25%+
  foreign-owned US corporations even at zero revenue; cannot be e-filed.
- 83(b) election window: **30 days** from stock grant; irreversible if missed.
- Delaware franchise tax: **~$400 minimum**, due **March 1**.
- EIN by fax (no SSN/ITIN responsible party): **~2–4 weeks**.
- BOI/FinCEN: **domestic entities exempt** under the March 2025 interim final rule
  (in effect as of 2026); interim and subject to finalization — verify on
  FinCEN.gov.
- IRC 1441 withholding on FDAP to non-US persons: **30%**, treaty-reducible.

## Honest boundary

This document gives the map, the sequence, and the verified traps. It does **not**
make the **[PRO]** decisions — and for a cross-border founder pair intending to
raise, there are more of those than usual, concentrated in tax structure and the
Starfysh-IP question. The two professional engagements (cross-border tax advisor
first, then startup lawyer) are not optional polish; per every source consulted,
the cross-border tax errors are the expensive, hard-to-unwind ones, and they're
locked in at formation.
