# AI UI design stack

Four layers that stop an agent shipping generic UI. Assembled 28 Aug 2026,
every source pulled from the primary repo or the tool's own CLI.

| # | Layer | What it does | Status |
|---|-------|--------------|--------|
| 01 | `design-taste-frontend/SKILL.md` | Judgment — layout, type, spacing, motion | Ready |
| 02 | `AGENTS.md` | Correctness — focus rings, hit targets, forms, perf | Ready |
| 03 | `design-md/*/DESIGN.md` | Identity — palette, type scale, component language | Ready, pick one |
| 04 | `mcp.json` | Components — 12,000+ React components in the editor | Ready, needs your API key |

Nothing here needs `npx` any more. The two steps that wanted a terminal on
this machine were run elsewhere and their output is checked in below.

---

## 01 — Taste skill

`design-taste-frontend/SKILL.md`, 1,200 lines, the v2 skill from
`Leonxlnx/taste-skill`. Identical to what `npx skills add` installs.

To make Claude Code pick it up, copy the folder to either:

    %USERPROFILE%\.claude\skills\design-taste-frontend\     (all projects)
    <your-project>\.claude\skills\design-taste-frontend\    (one project)

Read Section 0 (Brief Inference) before you use it. The dials near the top
are the part that actually changes the output.

---

## 02 — Web interface guidelines

`AGENTS.md`, Vercel's nine sections of MUST/SHOULD/NEVER. Drop it at the root
of the project you're building. Framework-agnostic apart from a couple of
React notes.

---

## 03 — DESIGN.md

Three identities pulled via `getdesign`. Copy exactly one into your project
root as `DESIGN.md`:

    design-md\airbnb\DESIGN.md       Warm coral #ff385c on white. Photography
                                     carries the page, pill search bars, 14px
                                     card radii, nothing sharp anywhere.
                                     Best fit for cracker shops and local retail.

    design-md\starbucks\DESIGN.md    Warm cream #f2f0eb canvas, four-tier green
                                     system, full-pill buttons, gold reserved for
                                     rewards. Retail warmth without going neon;
                                     also the easiest of the three to recolour.

    design-md\linear.app\DESIGN.md   Near-black #010102, lavender #5e6ad2 accent,
                                     dense and technical. For a SaaS tool or
                                     dashboard — it will fight a warm retail brand.

Use one at a time. Mixing two produces exactly the muddle the stack exists to
prevent. To swap later, overwrite the project's `DESIGN.md` with a different one.

Any of the other 74 brands: `npx getdesign@latest list`, then
`npx getdesign@latest add <brand>`.

---

## 04 — 21st MCP

`mcp.json` holds the server config. See `21st-mcp-SETUP.md` — three steps:
copy it into a project as `.mcp.json`, `setx API_KEY_21ST`, restart Claude Code.

---

## Load order when you brief the agent

1. **DESIGN.md** — identity. Hardest constraint, so it goes first.
2. **Taste skill** — judgment. Tune the dials to the artefact.
3. **21st** — parts, adapted to the tokens from step 1.
4. **AGENTS.md** — audit last. Invert this and you get a correct,
   forgettable page.

---

## Notes on the source page

Accurate on the things that matter — the repos are real, the install names are
right. Two details were off: it says the Vercel guidelines have seven sections
(nine), and its step 03 (`cp ~/Downloads/DESIGN.md ./DESIGN.md`) assumes you
already downloaded a DESIGN.md without ever telling you to.

`@21st-dev/cli` was at 1.16.1 on 28 Aug 2026. Star counts and versions go stale
fast — re-check before relying on them.
