# Screenshot manifest (owned by the main session)

All screenshots are captured from the deployed demo (`https://mvp-veloce.vercel.app`)
logged in as the seeded demo users (password `veloce-ft`). Files land in `site/images/`.
Pages reference these exact filenames so capture and authoring can proceed in parallel.

| File | Role / page | Shows |
| --- | --- | --- |
| `00-login.png` | Login | Sign-in screen + role intro |
| `trader-01-dashboard.png` | Trader | Role dashboard (KPIs + tasks) |
| `trader-02-blotter.png` | Trader | RFQ blotter across statuses |
| `trader-03-create.png` | Trader | Create-RFQ wizard step |
| `trader-04-board.png` | Trader | RFQ detail + quote board |
| `approver-01-dashboard.png` | Approver | Role dashboard |
| `approver-02-queue.png` | Approver | Approvals queue |
| `approver-03-detail.png` | Approver | Approval detail + threshold flags / committee note |
| `ops-01-dashboard.png` | Ops | Role dashboard |
| `ops-02-trades.png` | Ops | Trade capture + handoff cards |
| `ops-03-payload.png` | Ops | STP payload preview |
| `compliance-01-dashboard.png` | Compliance | Role dashboard |
| `compliance-02-bestex.png` | Compliance | Best-execution evidence |
| `compliance-03-concentration.png` | Compliance | Dealer concentration (USD-indicative label) |
| `admin-01-dashboard.png` | Admin | Role dashboard |
| `admin-02-panels.png` | Admin | Bank-panel management |
| `dealer-01-quote.png` | Dealer | `/quote/[token]` response surface (if a token is available) |

Naming: `{role}-{NN}-{slug}.png`. If a shot can't be captured (e.g. no live auction,
no dealer token), the user-guide page notes it instead of leaving a broken image.
