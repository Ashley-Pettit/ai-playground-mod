import { atom, read, update } from 'claude-code'
import type { CommandRunInput, CommandRunResult, EngineInterface, Register } from 'claude-code'

import type { Busy, Run } from '../types'
import { deckSvg } from './art'
import { BRIEF_VERSION, TASK_WHEN, retask, setup, work } from './brief'
import type { Places } from './brief'

// Where the person's dashboard is, what it holds for Claude, and what Claude is doing about it.
const dashboardAtom = atom({ plugin: 'self-improve', key: 'dashboard' } as const, '')
const waitingAtom = atom({ plugin: 'self-improve', key: 'waiting' } as const, -1)
const busyAtom = atom({ plugin: 'self-improve', key: 'busy' } as const, 'idle' as Busy)
// Change the tag when Run's fields change: it declines what an earlier version stored.
const runAtom = atom(
  { plugin: 'self-improve', key: 'run' } as const,
  { since: 0, asked: '', turnId: '', leftover: 0, leftoverAt: 0, isWatching: false } as Run,
  { shape: 'run-1' },
)

const PANE = 'self-improve'
const TITLE = 'AI Playground'
// /improve, the original name (another mod's button may run it), and /playground, by the name.
const COMMAND = 'improve'
const ALIAS = 'playground'
const ACCENT = '#7c3aed'
const WARN_COLOUR = '#d97706'
// How often the chat that opened the panel looks for requests pressed in the dashboard.
const POLL_MS = 30_000
// Work asked of Claude this long ago whose turn was never seen to end is taken as over; and
// requests Claude's last turn left queued are handed over again after this long.
const STALE_MS = 30 * 60_000
// A slash command cannot start a turn while it is itself being answered, so what
// /improve wants of Claude is asked a moment after it returns.
const SOON_MS = 250

const isUrl = (value: unknown): value is string => typeof value === 'string' && /^https:\/\/claude\.ai\/(code\/)?artifact\/[A-Za-z0-9_-]+$/.test(value)

const slashes = (path: string) => path.replace(/\\/g, '/').replace(/\/+$/, '')

// The dashboard's page, which set-up publishes, and where a run saves its screenshots: the
// plugin's own data folder, which outlives an update, or beside the plugin where there is none.
const places = async ($: EngineInterface): Promise<Places> => {
  const root = slashes($.plugin.root)
  let data = ''
  try {
    data = (await $.process.hookEnv()).CLAUDE_PLUGIN_DATA ?? ''
  } catch {
    // Beside the plugin, then.
  }
  return { page: `${root}/dashboard/index.html`, shots: data ? `${slashes(data)}/shots` : `${root}/.shots` }
}

// A short fingerprint of what Claude was asked, to know the turn that carries it when it starts.
const fingerprint = (text: string) => {
  let hash = 5381
  for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0
  return `${text.length}:${(hash >>> 0).toString(36)}`
}

// What the store holds: the dashboard any session last recorded.
const restore = async ($: EngineInterface) => {
  const saved = await $.store.get('dashboard')
  const url = isUrl(saved) ? saved : ''
  if ((await read($, dashboardAtom)) !== url) await update($, dashboardAtom, () => url)
}

const setBusy = async ($: EngineInterface, busy: Busy, asked = '') => {
  const since = busy === 'idle' ? 0 : await $.clock.now()
  await update($, runAtom, run => ({ ...run, since, asked, turnId: busy === 'idle' ? '' : run.turnId }))
  if ((await read($, busyAtom)) !== busy) await update($, busyAtom, () => busy)
}

// Hands words to Claude in this chat, and notes what it is busy with until the turn that
// answers them ends. Not waited on: that turn may be a long one.
const ask = async ($: EngineInterface, busy: Exclude<Busy, 'idle'>, text: string) => {
  await setBusy($, busy, fingerprint(text))
  $.prompt.submit({ text }).catch(async () => {
    await setBusy($, 'idle')
    $.ui.toast("AI Playground couldn't reach the chat. Try again.")
  })
}

const openInBrowser = async ($: EngineInterface, url: string) => {
  let system = ''
  try {
    system = (await $.session.machine()).sysname
  } catch {
    // Told by the plugin's own path instead.
  }
  const isWindows = /^(windows|mingw|msys|cygwin)/i.test(system) || (system === '' && /^[A-Za-z]:[\\/]/.test($.plugin.root))
  const isMac = /^darwin/i.test(system) || (system === '' && $.plugin.root.startsWith('/Users/'))
  const argv = isWindows ? ['rundll32', 'url.dll,FileProtocolHandler', url] : [isMac ? 'open' : 'xdg-open', url]
  try {
    const ran = await $.process.run(argv, { timeoutMs: 10_000 })
    if (ran.exitCode !== 0) throw new Error(ran.stderr)
  } catch {
    $.ui.toast(`Couldn't open your dashboard. It is at ${url}`)
  }
}

// Shows the dashboard inside Claude, in its own artifact pane. Where Claude refuses or cannot,
// the person's browser opens it instead.
const showDashboard = async ($: EngineInterface, url: string) => {
  try {
    const shown = await $.tool.call({ tool: 'Artifact', action: 'open', url } as never)
    if (shown.deny === undefined && shown.isError !== true) return
  } catch {
    // The browser is the way that always works.
  }
  await openInBrowser($, url)
}

// The dashboard is shown a moment after a command returns: showing it is a tool call of its own.
const reveal = ($: EngineInterface, url: string) => {
  $.clock.after(SOON_MS, () => {
    showDashboard($, url).catch(() => undefined)
  })
}

// How many requests wait in the dashboard, read with no turn of the model:
// -1 when the read was refused, failed or said something unexpected.
const count = async ($: EngineInterface, dashboard: string) => {
  try {
    const ran = await $.tool.call({
      tool: 'ArtifactData',
      action: 'query',
      url: dashboard,
      collection: 'requests',
      query: { where: [['state', '==', 'queued']], limit: 50 },
    } as never)
    if (ran.deny !== undefined || ran.isError === true) return -1
    const said = `${typeof ran.text === 'string' ? ran.text : ''} ${typeof ran.result === 'string' ? ran.result : JSON.stringify(ran.result ?? '')}`
    if (/No documents matched/.test(said)) return 0
    const found = /(\d+) documents? from collection/.exec(said)
    return found === null ? -1 : Number(found[1])
  } catch {
    return -1
  }
}

const setWaiting = async ($: EngineInterface, waiting: number) => {
  if ((await read($, waitingAtom)) !== waiting) await update($, waitingAtom, () => waiting)
}

// Looks for requests pressed in the dashboard and hands them to Claude, once: nothing more is
// handed over while Claude works on them, nor the ones its last turn left, until more arrive.
const pump = async ($: EngineInterface) => {
  const dashboard = await read($, dashboardAtom)
  if (dashboard === '') return
  const waiting = await count($, dashboard)
  await setWaiting($, waiting)
  const busy = await read($, busyAtom)
  const run = await read($, runAtom)
  if (waiting === 0) {
    if (run.leftover !== 0) await update($, runAtom, r => ({ ...r, leftover: 0 }))
    if (busy === 'requests') await setBusy($, 'idle')
    return
  }
  if (waiting < 0) return
  const now = await $.clock.now()
  const isStale = busy !== 'idle' && now - run.since > STALE_MS
  const isNew = waiting > run.leftover || now - run.leftoverAt > STALE_MS
  if ((busy === 'idle' && isNew) || isStale) await ask($, 'requests', work(dashboard, await places($)))
}

// Only the chat that opened the panel watches the dashboard, so its requests land in one chat.
// The timer stops when the mod reloads; the session's note brings it back at the next start.
let watching: { cancel: () => void } | undefined

const watch = async ($: EngineInterface) => {
  watching?.cancel()
  watching = $.clock.every(POLL_MS, () => {
    pump($).catch(() => undefined)
  })
  if (!(await read($, runAtom)).isWatching) await update($, runAtom, r => ({ ...r, isWatching: true }))
}

// What happens once the turn answering the panel has ended, by what it was asked.
const settle = async ($: EngineInterface, busy: Busy, isAborted: boolean) => {
  if (busy === 'setup') {
    await setBusy($, 'idle')
    if ((await read($, dashboardAtom)) === '') {
      $.ui.toast(isAborted ? 'Set-up was stopped. Press Set up AI Playground to start again.' : "Set-up didn't finish. Press Set up AI Playground to try again.")
    }
    return
  }
  if (busy === 'update') {
    await setBusy($, 'idle')
    if (isAborted) {
      // Asked again at the next /improve.
      await $.store.delete('brief')
      $.ui.toast('Your dashboard and hourly task were not brought up to date. Run /improve to try again.')
    }
    return
  }
  if (busy === 'requests') {
    const dashboard = await read($, dashboardAtom)
    const left = dashboard === '' ? -1 : await count($, dashboard)
    await setWaiting($, left)
    const now = await $.clock.now()
    await update($, runAtom, r => ({ ...r, leftover: Math.max(0, left), leftoverAt: now }))
    await setBusy($, 'idle')
    if (left > 0) $.ui.toast(`${left} request${left === 1 ? ' is' : 's are'} still waiting. Press Run requests to try again.`)
  }
}

// /improve goes straight to the dashboard, shown inside Claude; "/improve panel" also opens the
// panel of requests beside the chat. The first time, there is no dashboard yet: the panel opens
// and Claude is asked to set it up.
const openCommand = async ($: EngineInterface, e: CommandRunInput): Promise<CommandRunResult> => {
  await restore($)
  const dashboard = await read($, dashboardAtom)
  const busy = await read($, busyAtom)
  if (dashboard === '') {
    await $.ui.open({ id: PANE, title: TITLE })
    if (busy === 'setup') return { text: 'Claude is already setting up AI Playground in this chat.' }
    const where = await places($)
    $.clock.after(SOON_MS, () => void ask($, 'setup', setup(where)))
    return { text: 'Setting up AI Playground.' }
  }
  if (e.args.trim() === 'panel') await $.ui.open({ id: PANE, title: TITLE })
  reveal($, dashboard)
  await watch($)
  // A task made by an older version still runs that version's words: Claude updates it, once.
  if ((await $.store.get('brief')) !== BRIEF_VERSION && busy !== 'update') {
    await $.store.set('brief', BRIEF_VERSION)
    const where = await places($)
    $.clock.after(SOON_MS, () => void ask($, 'update', retask(dashboard, where)))
    return { text: 'Opening your AI Playground dashboard, and bringing it and its hourly task up to date.' }
  }
  $.clock.after(SOON_MS, () => {
    pump($).catch(() => undefined)
  })
  return { text: 'Opening your AI Playground dashboard.' }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    const description = "Open AI Playground: Claude improves a private copy of each app, and you cherry-pick the improvements into dev, UAT or prod (add 'panel' to also open the requests panel)"
    await $.command.register({ name: COMMAND, description })
    await $.command.register({ name: ALIAS, description })
    await $.tool.register({
      name: 'set_dashboard',
      description: "Tells the AI Playground panel where the person's AI Playground dashboard is, once that artifact exists. Call it once, during set-up.",
      inputSchema: { type: 'object', properties: { url: { type: 'string', description: "The dashboard artifact's claude.ai url." } }, required: ['url'] },
    })
    await restore($)
    // After a reload of the mod, the chat that was watching goes on watching.
    if ((await read($, runAtom)).isWatching && (await read($, dashboardAtom)) !== '') await watch($)
    return started
  })

  // The turn that carries what the panel asked starts: from now on its end is what the panel waits for.
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      const run = await read($, runAtom)
      if (run.asked !== '' && fingerprint(e.text) === run.asked) await update($, runAtom, r => ({ ...r, asked: '', turnId: e.turnId }))
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    const run = await read($, runAtom)
    if (run.turnId !== '' && run.turnId === e.turnId) {
      await update($, runAtom, r => ({ ...r, turnId: '' }))
      await settle($, await read($, busyAtom), e.isAborted)
    }
    return done
  })

  // Claude reports where the dashboard is; from then on the panel links to it and watches it.
  on('tool.call', { tool: 'mcp__self-improve__set_dashboard' }, async ($, e) => {
    const url = (e as { url?: unknown }).url
    if (!isUrl(url)) return { isError: true, result: 'url must be the claude.ai url of the dashboard artifact.' }
    await $.store.set('dashboard', url)
    // Set-up has just made the task with this version's words.
    await $.store.set('brief', BRIEF_VERSION)
    await update($, dashboardAtom, () => url)
    await setBusy($, 'idle')
    reveal($, url)
    await watch($)
    return { result: 'Recorded. The dashboard is being shown to the person.' }
  })

  on('command.run', { command: COMMAND }, openCommand)
  on('command.run', { command: ALIAS }, openCommand)

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const elements = $.ui.resolve(e)
    const { Box, Button, Link, Text } = elements
    const dashboard = await read($, dashboardAtom)
    const waiting = await read($, waitingAtom)
    const busy = await read($, busyAtom)
    const hasArt = e.surface !== 'terminal' && 'Svg' in elements

    const startSetup = async () => {
      if ((await read($, busyAtom)) === 'setup') return
      await ask($, 'setup', setup(await places($)))
    }
    const run = async () => {
      const url = await read($, dashboardAtom)
      if (url === '') return
      if ((await read($, busyAtom)) !== 'idle') {
        $.ui.toast('Claude is already working in this chat. Press Stop waiting first if it has stopped.')
        return
      }
      await ask($, 'requests', work(url, await places($)))
    }
    const check = async () => {
      await restore($)
      await pump($)
    }
    // Gives up waiting on work Claude never finished.
    const stopWaiting = () => setBusy($, 'idle')

    const header =
      hasArt && 'Svg' in elements ? (
        <elements.Svg
          key="header"
          source={deckSvg({ isLinked: dashboard !== '', waiting, isBusy: busy !== 'idle' })}
          alt={`AI Playground: ${dashboard === '' ? 'not set up yet' : waiting < 0 ? 'dashboard linked' : `${waiting} requests waiting for Claude`}.`}
        />
      ) : (
        <Text bold color="claude">AI Playground</Text>
      )

    if (dashboard === '') {
      return (
        <Box flexDirection="column" gap={1}>
          {header}
          <Box flexDirection="column">
            <Text bold color={ACCENT}>Set-up</Text>
            <Text>Claude improves a private AI playground copy of each app you switch on, and you choose which improvements move into dev, UAT and prod. Your apps are never touched until you do.</Text>
            <Text dimColor>Set-up is one step: Claude publishes your AI Playground dashboard, lists your artifacts in it and makes its hourly task.</Text>
          </Box>
          {busy === 'setup' ? (
            <Box gap={1} alignItems="center" flexWrap="wrap">
              <Text color={WARN_COLOUR}>Claude is setting it up in the chat. Your dashboard opens when it is ready.</Text>
              <Button key="stop-waiting" label="Stop waiting" onPress={stopWaiting} />
            </Box>
          ) : (
            <Button key="setup" label="Set up AI Playground" variant="primary" onPress={startSetup} />
          )}
        </Box>
      )
    }

    const doing =
      busy === 'requests'
        ? 'Claude is working on your requests in this chat.'
        : busy === 'update'
          ? 'Claude is bringing your dashboard and hourly task up to date in this chat.'
          : waiting > 0
            ? `${waiting} request${waiting === 1 ? '' : 's'} waiting for Claude.`
            : waiting === 0
              ? 'Nothing is waiting for Claude.'
              : "This panel can't see your dashboard's requests from here. After you press Improve now or Add in the dashboard, press Run requests."

    return (
      <Box flexDirection="column" gap={1}>
        {header}
        <Box flexDirection="column">
          <Text bold color={ACCENT}>Your dashboard</Text>
          <Text>Set each app to Off, Cherry-pick or Immediate, look at before and after screenshots, and move the improvements you like from the AI playground into dev, UAT or prod.</Text>
          <Link key="open-dashboard" href={dashboard} label="Open your dashboard ↗" />
        </Box>
        <Box flexDirection="column">
          <Text bold color={ACCENT}>Requests</Text>
          <Text>{doing}</Text>
          <Box gap={1} alignItems="center" flexWrap="wrap">
            <Button key="run" label="Run requests" variant="primary" onPress={run} />
            <Button key="check" label="Check for requests" onPress={check} />
            {busy === 'idle' ? null : <Button key="stop-waiting" label="Stop waiting" onPress={stopWaiting} />}
          </Box>
          <Text dimColor>{`While this panel is open it checks every half minute. Requests also run by themselves ${TASK_WHEN}, while the Claude app is open.`}</Text>
        </Box>
      </Box>
    )
  })
}
