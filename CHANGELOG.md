# Changelog

## 0.8.0

### Added
- **A new name: AI Playground – App Self-Improvement Cherry Picker.** The plugin id stays `self-improve`, so installs, settings and your saved dashboard carry over. `/playground` opens it, and `/improve` still works.
- **Your dashboard updates itself.** The first `/playground` after an update republishes your dashboard to its same link with its data intact, so new buttons such as UAT appear.
- **UAT stage.** Each improvement can now go to dev, UAT or prod. Claude makes an app's UAT copy (titled `<app> · UAT`) the first time something is added to it.
- **"Where a change goes" in the dashboard.** The How it works panel shows the path AI playground → Dev → UAT → Prod and explains why the playground comes before dev.
- **"Make it better, don't ask me how."** Every improvement pass says so, and tells Claude to decide for itself and never stop to ask.
- **Hourly task update.** In the same step, the scheduled task gets this version's instructions. If that turn is stopped, the next `/playground` tries again.
- A plugin icon and a changelog.

### Changed
- The panel now knows when Claude's turn on its request has ended, so "working" clears right away instead of after half an hour.
- Requests Claude's last turn could not finish are not handed over again on every check. They go again when new ones arrive, after 30 minutes, or when you press Run requests.
- Run requests and Set up ignore a second press while Claude is already working.
- The chat that watches the dashboard keeps watching after the mod reloads, and work Claude is already doing is not handed over a second time.
- Screenshots are kept in the plugin's data folder, which outlives updates.
- The browser is chosen from the computer's operating system, not from the plugin's folder path.
- The dashboard and panel call the private copy the "AI playground". Its artifact title still ends in `· AI experimental`, so existing copies are found.
- An app's links follow the path: AI playground, dev, UAT, prod.

### Fixed (dashboard)
- Cancel could leave a request queued, so a cancelled change still went to dev. Cancel now removes what the store holds, is hidden once Claude has started, and only puts back the stages still being added.
- Improve now could stick on "Queued…" when its request failed to save.
- A double click queued the same request twice.
- The page could flash "No apps listed yet" while it was still loading.
- "Latest" could name an improvement you had skipped.
- One failed connection showed "Connection lost" next to "Live sync"; a store that never answers now says so after 10 seconds.
- The page listens only to unfinished requests, and Claude deletes finished ones after 7 days, so the dashboard never fills up.
- Each save error now says what went wrong, instead of one message for everything.
- Keyboard focus stays on a button that turns busy, and goes to the app's heading when its button disappears.
- Less motion, when your device asks for it: the header's scan line goes and the title holds still.
- The "How it works" focus ring is no longer clipped, a screen reader no longer re-announces the latest line every minute, and the chosen Off mode is easier to see.
- Long words no longer push the page sideways on a phone.
- Screenshots load only as they come on screen.
- Screenshot ids and category names from the database are checked before use.
- The page still loads on a runtime that can't filter or order a list.

## 0.7.1

- The version this changelog starts from.
