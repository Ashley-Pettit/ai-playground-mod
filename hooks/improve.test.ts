import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import { expect, mock, test } from 'claude-code/testing'

import { BRIEF_VERSION, routine, setup, work } from './brief'

// The panel as the engine hands it to a ui.render hook.
const PANE = {
  title: 'AI Playground',
  isFocused: true,
  bodyColumns: 52,
  placement: 'dock',
  scroll: { offset: 0, bodyRows: 40 },
  view: {},
} as const

const panel = { plugin: 'self-improve', surface: 'desktop', component: 'Pane', requestId: 'self-improve', props: PANE } as const

const DASHBOARD = 'https://claude.ai/artifact/DDDDDDDDDDDDDDDDDDDDDD'
const IMPROVE = { command: 'improve', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } } as const
const PLACES = { page: 'C:/mods/self-improve/dashboard/index.html', shots: 'C:/mods/self-improve/.shots' }

// Stands for the session: records each prompt the panel sends to Claude.
const session = (on: On) => {
  const prompts: string[] = []
  on('prompt.submit', ($, e) => {
    prompts.push(e.text)
    return { text: e.text }
  })
  return prompts
}

// Stands for the host: records each program the panel asks it to run, and lets panes open.
const host = (on: On) => {
  const ran: (readonly string[])[] = []
  on('process.run', ($, e) => {
    ran.push(e.argv)
    return { value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  return ran
}

// Stands for the dashboard's database: how many requests are queued there, as the ArtifactData tool says it.
const database = (on: On) => {
  const held = { queued: 0, isDown: false, reads: 0 }
  on('tool.call', { tool: 'ArtifactData' }, () => {
    held.reads += 1
    if (held.isDown) return { isError: true, result: 'not reachable' } as never
    const said = held.queued === 0 ? 'No documents matched in collection "requests".' : `${held.queued} document${held.queued === 1 ? '' : 's'} from collection "requests":\n{"id":"r1","data":{"state":"queued"}}`
    return { result: said } as never
  })
  return held
}

// Stands for Claude's own artifact pane: records each artifact it is asked to show, or refuses to show any.
const viewer = (on: On) => {
  const held = { shown: [] as string[], isRefusing: false }
  on('tool.call', { tool: 'Artifact' }, ($, e) => {
    if (held.isRefusing) return { isError: true, result: 'cannot show it here' } as never
    held.shown.push(String((e as { url?: unknown }).url))
    return { result: 'shown' } as never
  })
  return held
}

const setDashboard = (url: string) => ({ tool: 'mcp__self-improve__set_dashboard', url }) as never

test('the first /improve asks Claude to set the dashboard up, and the panel says so', async ($, on) => {
  const clock = mock.clock(on)
  mock.store(on)
  const prompts = session(on)
  const ran = host(on)

  const ui = await $.ui.mount(panel)
  expect((await ui.find({ key: 'setup' }))?.text).toBe('Set up AI Playground')

  await $.command.run(IMPROVE)
  // Asked a moment after the command returns, not during it.
  expect(prompts).toHaveLength(0)
  await clock.advance(250)

  expect(prompts).toHaveLength(1)
  expect(prompts[0]).toMatch(/AI Playground: set me up/)
  expect(prompts[0]).toMatch(/publish the file .*dashboard\/index\.html as a NEW private artifact/)
  expect(prompts[0]).toMatch(/capabilities \{"db": \{\}, "user": \{\}, "assets": \{\}\}/)
  expect(prompts[0]).toMatch(/mcp__self-improve__set_dashboard/)
  expect(prompts[0]).toMatch(/taskId "self-improve", title "AI Playground", cronExpression "7 \* \* \* \*"/)
  expect(await ui.find({ type: 'Text', text: 'Claude is setting it up in the chat' })).toBeDefined()
  // No dashboard yet, so nothing is opened in the browser.
  expect(ran).toHaveLength(0)
})

test('once Claude says where the dashboard is, the panel links to it and it is shown inside Claude', async ($, on) => {
  const clock = mock.clock(on)
  mock.store(on)
  const ran = host(on)
  database(on)
  const pane = viewer(on)

  const ui = await $.ui.mount(panel)
  const refused = await $.tool.call(setDashboard('https://example.com/not-an-artifact'))
  expect(refused.isError).toBe(true)

  await $.tool.call(setDashboard(DASHBOARD))
  await clock.advance(250)

  expect(await ui.find({ type: 'Link', text: 'Open your dashboard' })).toBeDefined()
  expect(await ui.find({ key: 'setup' })).toBeUndefined()
  expect(pane.shown).toHaveLength(1)
  expect(pane.shown[0]).toBe(DASHBOARD)
  // Shown inside Claude, so the browser is left alone.
  expect(ran).toHaveLength(0)
})

test('where Claude cannot show the dashboard itself, /improve opens it in the browser', async ($, on) => {
  const clock = mock.clock(on)
  mock.store(on, { dashboard: DASHBOARD })
  const ran = host(on)
  database(on)
  const pane = viewer(on)
  pane.isRefusing = true

  await $.command.run(IMPROVE)
  await clock.advance(250)

  expect(pane.shown).toHaveLength(0)
  expect(ran[0]?.at(-1)).toBe(DASHBOARD)
})

test('/improve shows the dashboard inside Claude, and requests pressed there are handed to Claude once', async ($, on) => {
  const clock = mock.clock(on)
  mock.store(on, { dashboard: DASHBOARD, brief: BRIEF_VERSION })
  const prompts = session(on)
  const ran = host(on)
  const db = database(on)
  const pane = viewer(on)

  const ui = await $.ui.mount(panel)
  await $.command.run(IMPROVE)

  await clock.advance(250)
  expect(pane.shown[0]).toBe(DASHBOARD)
  expect(ran).toHaveLength(0)
  expect(prompts).toHaveLength(0)
  expect(await ui.find({ type: 'Text', text: 'Nothing is waiting for Claude.' })).toBeDefined()

  // Something is pressed in the dashboard: the next look, half a minute on, hands it over.
  db.queued = 2
  await clock.advance(30_000)
  expect(prompts).toHaveLength(1)
  expect(prompts[0]).toMatch(/run the requests waiting in my dashboard/)
  expect(prompts[0]).toMatch(/ArtifactData tool, url https:\/\/claude\.ai\/artifact\/DDDDDDDDDDDDDDDDDDDDDD/)
  expect(await ui.find({ type: 'Text', text: 'Claude is working on your requests in this chat.' })).toBeDefined()

  // Still queued at the next look: not handed over a second time.
  await clock.advance(30_000)
  expect(prompts).toHaveLength(1)

  // Claude takes them (none queued any more), then a new one is pressed: that is handed over.
  db.queued = 0
  await clock.advance(30_000)
  expect(await ui.find({ type: 'Text', text: 'Nothing is waiting for Claude.' })).toBeDefined()
  db.queued = 1
  await clock.advance(30_000)
  expect(prompts).toHaveLength(2)
})

test('where the panel cannot read the dashboard, nothing is sent by itself and Run requests asks Claude', async ($, on) => {
  const clock = mock.clock(on)
  mock.store(on, { dashboard: DASHBOARD, brief: BRIEF_VERSION })
  const prompts = session(on)
  host(on)
  const db = database(on)
  db.isDown = true
  viewer(on)

  const ui = await $.ui.mount(panel)
  await $.command.run(IMPROVE)
  await clock.advance(60_000)

  expect(prompts).toHaveLength(0)
  expect(await ui.find({ type: 'Text', text: "This panel can't see your dashboard's requests from here" })).toBeDefined()

  await ui.press({ key: 'run' })
  expect(prompts).toHaveLength(1)
  expect(prompts[0]).toMatch(/run the requests waiting in my dashboard/)

  await ui.press({ key: 'stop-waiting' })
  expect(await ui.find({ key: 'stop-waiting' })).toBeUndefined()
})

test('a chat that never opened the panel does not watch the dashboard', async ($, on) => {
  const clock = mock.clock(on)
  mock.store(on, { dashboard: DASHBOARD })
  const prompts = session(on)
  host(on)
  const db = database(on)
  db.queued = 3

  await $.ui.mount(panel)
  await clock.advance(120_000)

  expect(db.reads).toBe(0)
  expect(prompts).toHaveLength(0)
})

test('the scheduled run stands alone: requests first, then only the apps switched on and due, and an original only on Immediate', () => {
  const asked = routine(DASHBOARD, PLACES)

  expect(asked).toMatch(/First, the requests\. Query "requests" where state is "queued"/)
  expect(asked).toMatch(/every app that is switched on \(mode "pick" or "immediate"\) and due/)
  expect(asked).toMatch(/cadence is "hourly" is due on every run/)
  expect(asked).toMatch(/cadence is "daily" is due when it is 9am or later here and its last_run_at is not today/)
  expect(asked).toMatch(/never change, republish or delete it in a pass, except in step 5 when the app's mode is "immediate"/)
  expect(asked).toMatch(/put the improvements made in this pass, and only those, into the live version/)
  expect(asked).toMatch(/live "in", applied "auto"/)
  expect(asked).toMatch(/publish a NEW private artifact with that title that is an exact working copy/)
  expect(asked).toMatch(/take two screenshots/)
  expect(asked).toMatch(/asset true/)
  // It needs none of the mod's own tools.
  expect(asked).not.toMatch(/mcp__self-improve__/)
})

test('a pass stops at its token budget, and an uploaded website is rebuilt as a live version and a copy', () => {
  const asked = work(DASHBOARD, PLACES)

  expect(asked).toMatch(/If the app's budget is over 0, keep a rough running count of the tokens this pass has used/)
  expect(asked).toMatch(/always make at least one: a pass that stops at 1, 2 or 3 this way is a whole pass/)
  expect(asked).toMatch(/last_run_stopped \("budget" if the budget stopped it, otherwise null\)/)

  expect(asked).toMatch(/kind "import": rebuild the uploaded website named by import_id/)
  expect(asked).toMatch(/paths \(the asset ids from files, up to 256 a call\)/)
  expect(asked).toMatch(/Never invent content and never drop a page/)
  expect(asked).toMatch(/one titled the import's name, which is now my live version, and an exact copy titled the name followed by " · AI experimental"/)
  expect(asked).toMatch(/Never delete the uploaded files/)
})

test('a cherry-pick changes one version only, and set-up never publishes a second dashboard', () => {
  const asked = work(DASHBOARD, PLACES)
  expect(asked).toMatch(/target "live": the live version is the app's own artifact/)
  expect(asked).toMatch(/target "dev": the dev version is the app's dev_url artifact/)
  expect(asked).toMatch(/never touch the live version/)
  expect(asked).toMatch(/Change that one version only/)

  const first = setup(PLACES)
  expect(first).toMatch(/If there is one, use it and publish nothing/)
  expect(first).toMatch(/DASHBOARD_URL replaced by the dashboard's url everywhere/)
  expect(first).toMatch(/Never delete a document, and never change auto/)
})

test('after an update, the first /improve brings the hourly task up to date, once', async ($, on) => {
  const clock = mock.clock(on)
  mock.store(on, { dashboard: DASHBOARD })
  const prompts = session(on)
  host(on)
  database(on)
  viewer(on)

  await $.command.run(IMPROVE)
  await clock.advance(250)
  expect(prompts).toHaveLength(1)
  expect(prompts[0]).toMatch(/bring my dashboard and its scheduled task up to date/)
  expect(prompts[0]).toMatch(/action "publish", url https:\/\/claude\.ai\/artifact\/DDDDDDDDDDDDDDDDDDDDDD/)
  expect(prompts[0]).toMatch(/Leave capabilities out/)
  expect(prompts[0]).toMatch(/never publish a new dashboard/)
  expect(prompts[0]).toMatch(/update_scheduled_task/)
  expect(prompts[0]).toMatch(/target "uat"/)
  expect(prompts[0]).toMatch(/https:\/\/claude\.ai\/artifact\/DDDDDDDDDDDDDDDDDDDDDD/)
  expect(prompts[0]).not.toMatch(/DASHBOARD_URL/)

  await $.command.run(IMPROVE)
  await clock.advance(250)
  expect(prompts.filter(p => /bring my dashboard and its scheduled task up to date/.test(p))).toHaveLength(1)
})

test('a run makes it better without asking, and a change can go to dev, UAT or prod', () => {
  const asked = routine(DASHBOARD, PLACES)
  expect(asked).toMatch(/make it better, don't ask me how/)
  expect(asked).toMatch(/never stop to ask me a question/)
  expect(asked).toMatch(/target \("dev", "uat" or "live"\)/)
  expect(asked).toMatch(/target "uat": the same as dev, with the app's uat_url artifact and the title followed by " · UAT"/)
  expect(asked).toMatch(/never touch dev or the live version/)
  expect(asked).toMatch(/dev "no", uat "no", live "no"/)
  expect(asked).toMatch(/delete every request in state "done" or "failed" whose created_at is more than 7 days ago/)
  expect(asked).toMatch(/"· AI experimental", " · Dev" or " · UAT"|" · AI experimental", " · Dev" or " · UAT"/)
})

// Stands for the engine running the turn that answers what the panel asked.
const engine = (on: On) => {
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'improve' } }) as never)
  on('tool.register', () => ({ value: {} }) as never)
}
const turn = async ($: Engine, text: string, id: string, isAborted = false) => {
  await $.turn.start({ text, turnId: id } as never)
  await $.turn.complete({ answer: '', durationMs: 1000, isAborted, turnId: id, reason: isAborted ? 'aborted' : 'completed' } as never)
}

test('once Claude has answered, requests its turn left are not handed over again until more arrive', async ($, on) => {
  engine(on)
  const clock = mock.clock(on)
  mock.store(on, { dashboard: DASHBOARD, brief: BRIEF_VERSION })
  const prompts = session(on)
  host(on)
  const db = database(on)
  viewer(on)

  const ui = await $.ui.mount(panel)
  await $.command.run(IMPROVE)
  db.queued = 2
  await clock.advance(30_000)
  expect(prompts).toHaveLength(1)

  // Claude's turn ends with both still queued (it could not do them): the panel stops waiting at once...
  await turn($, prompts[0]!, 't1')
  expect(await ui.find({ key: 'stop-waiting' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: '2 requests waiting for Claude.' })).toBeDefined()
  // ...and does not hand the same two over again on every look.
  await clock.advance(5 * 30_000)
  expect(prompts).toHaveLength(1)

  // A new one is pressed: that is handed over.
  db.queued = 3
  await clock.advance(30_000)
  expect(prompts).toHaveLength(2)
})

test('Run requests pressed twice asks Claude once', async ($, on) => {
  mock.clock(on)
  mock.store(on, { dashboard: DASHBOARD, brief: BRIEF_VERSION })
  const prompts = session(on)
  host(on)
  database(on).isDown = true
  viewer(on)

  const ui = await $.ui.mount(panel)
  await $.command.run(IMPROVE)
  await ui.press({ key: 'run' })
  await ui.press({ key: 'run' })
  expect(prompts).toHaveLength(1)
})

test('a set-up turn that ends without a dashboard puts the Set up button back', async ($, on) => {
  engine(on)
  const clock = mock.clock(on)
  mock.store(on)
  const prompts = session(on)
  host(on)

  const ui = await $.ui.mount(panel)
  await ui.press({ key: 'setup' })
  expect(prompts).toHaveLength(1)
  // While Claude sets up, there is no second Set up to press.
  expect(await ui.find({ key: 'setup' })).toBeUndefined()
  await $.command.run(IMPROVE)
  await clock.advance(250)
  expect(prompts).toHaveLength(1)

  await turn($, prompts[0]!, 's1')
  await clock.advance(0)
  expect(await ui.find({ key: 'setup' })).toBeDefined()
})

test('an hourly-task update that was stopped is asked for again at the next /improve', async ($, on) => {
  engine(on)
  const clock = mock.clock(on)
  mock.store(on, { dashboard: DASHBOARD })
  const prompts = session(on)
  host(on)
  database(on)
  viewer(on)

  await $.command.run(IMPROVE)
  await clock.advance(250)
  expect(prompts).toHaveLength(1)
  await turn($, prompts[0]!, 'u1', true)

  await $.command.run(IMPROVE)
  await clock.advance(250)
  expect(prompts.filter(p => /bring my dashboard and its scheduled task up to date/.test(p))).toHaveLength(2)
})

test('after a reload of the mod, the chat that was watching goes on watching', async ($, on) => {
  engine(on)
  const clock = mock.clock(on)
  mock.store(on, { dashboard: DASHBOARD, brief: BRIEF_VERSION })
  session(on)
  host(on)
  const db = database(on)
  // What this session's state held before the reload.
  on('state.get', ($, e, next) =>
    (e as { key?: string }).key === 'run'
      ? ({ value: { value: { shape: 'run-1', value: { since: 0, asked: '', turnId: '', leftover: 0, leftoverAt: 0, isWatching: true } }, version: 3 } } as never)
      : next(e),
  )

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await clock.advance(30_000)
  expect(db.reads).toBeGreaterThan(0)
})

test('the panel draws on every surface, before set-up and after', async ($, on) => {
  mock.clock(on)
  mock.store(on)
  host(on)
  database(on)
  viewer(on)

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...panel, surface })
    expect((await ui.find({ key: 'setup' }))?.text).toBe('Set up AI Playground')
    await ui.unmount()
  }
  await $.tool.call(setDashboard(DASHBOARD))
  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...panel, surface })
    expect(await ui.find({ key: 'run' })).toBeDefined()
    expect(await ui.find({ type: 'Link', text: 'Open your dashboard' })).toBeDefined()
    await ui.unmount()
  }
})

test('/playground does what /improve does, and set-up finds a dashboard by its old name too', async ($, on) => {
  const clock = mock.clock(on)
  mock.store(on)
  const prompts = session(on)
  host(on)

  await $.command.run({ ...IMPROVE, command: 'playground' })
  await clock.advance(250)
  expect(prompts).toHaveLength(1)
  expect(prompts[0]).toMatch(/AI Playground: set me up/)
  expect(prompts[0]).toMatch(/titled exactly "AI Playground" or "Self Improve"/)
})
