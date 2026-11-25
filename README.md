# AI Playground – App Self-Improvement Cherry Picker

A Claude Code mod that keeps your Claude artifacts getting better on their own. Claude works on a private **AI playground** copy of each app you switch on, as often as every hour and within a token budget you set. You look at each improvement, with before and after screenshots, and cherry-pick the ones you want into **dev**, **UAT** or **prod**.

Claude never asks you how. It decides for itself, records each improvement on its own, and leaves your real app alone until you pick something.

## Where a change goes

| Stage | What it is for |
| --- | --- |
| **AI playground** | Claude's own private copy of your app (titled `<app> · AI experimental`). It tries ideas there with nobody waiting. Most stay there. |
| **Dev** | Your workbench. Only the improvements you picked, to try together and fix up. |
| **UAT** | The rehearsal. People check it works for them before it ships. |
| **Prod** | Your live app, the one everyone uses. |

### Why a playground before dev?

Dev should only hold work you chose. Claude makes new ideas every hour, some great and some not, and pouring them all into dev would bury your own work and leave you sorting out which change broke what. The playground keeps every experiment in a copy of its own, so you can judge each one by itself and throw any away at no cost. Nothing leaves it until you cherry-pick it, so every change in dev is one you meant to make.

## Install

### In the Claude desktop app (easiest, no terminal)

1. Go to [claude.ai/customize/plugins](https://claude.ai/customize/plugins) and add the marketplace `Ashley-Pettit/ai-playground-mod`.
2. In the desktop app's **Code** tab, click **+** next to the prompt box, then **Add plugins** (or **Plugins**, then **Browse plugins**).
3. Add **self-improve**, start a new session and type `/playground`.

### In a terminal

At the prompt of a Claude Code session:

```
/plugin install self-improve --marketplace Ashley-Pettit/ai-playground-mod
```

Answer `y` to add the marketplace, then pick a scope (user is the usual choice).

Or straight from a shell:

```
claude plugin install self-improve --marketplace Ashley-Pettit/ai-playground-mod
```

The terminal route needs Claude Code's command line tool and Git on that computer.

## Use it

1. **Set up.** Run `/playground`. The first time, Claude publishes your own private AI Playground dashboard as a Claude artifact, lists your artifacts in it and makes an hourly scheduled task.
2. **Switch apps on.** In the dashboard's **Auto improve** tab, set an app to **Cherry-pick**, then choose how often it runs and its token budget.
3. **Pick what you like.** In the **Cherry-pick** tab, press **Add to dev**, **Add to UAT** or **Add to prod** on each improvement you want, or **Skip** the rest.

**Immediate** mode skips dev and UAT and puts each improvement straight into prod, so it asks you twice before it turns on.

| Command | What it does |
| --- | --- |
| `/playground` | Open your dashboard (the first time, set it up) |
| `/playground panel` | Also open the requests panel beside the chat |
| `/improve` | The same as `/playground` |

## Your data

Everything about your apps stays in your own Claude account: the dashboard is a private artifact only you can open, and the playground, dev and UAT copies are private artifacts of yours. Nothing in this repository holds your apps, your improvements or your screenshots.

## Needs

- Claude Code with mods (function-hook plugins), and the Claude app open for the hourly run.
- Claude artifacts and scheduled tasks on your account.

## Updating

After an update, the first `/playground` republishes your dashboard to its same link with its data kept, and brings the hourly task's instructions up to date. See [CHANGELOG.md](CHANGELOG.md).

## Licence

MIT. See [LICENSE](LICENSE).
