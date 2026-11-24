// What Claude has been asked to do from the panel and has not finished:
// nothing, the first set-up, the requests waiting in the dashboard, or
// bringing the hourly task up to date after the mod was updated.
export type Busy = 'idle' | 'setup' | 'requests' | 'update'

// The bookkeeping behind `busy`, kept in the session so a reload of the mod loses none of it.
export type Run = {
  // When Claude was last asked (ms since the epoch); 0 while idle.
  since: number
  // A fingerprint of the words Claude was asked, until the turn that carries them starts; then ''.
  asked: string
  // The turn answering what Claude was asked, while it runs; '' otherwise.
  turnId: string
  // Requests still queued when Claude's last turn on them ended, and when that was: the panel
  // does not hand the same ones over again until more arrive or half an hour has passed.
  leftover: number
  leftoverAt: number
  // This chat opened the panel, so it is the one that watches the dashboard.
  isWatching: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'self-improve': {
      // The url of the person's dashboard, a private artifact; '' until it has been made.
      dashboard: string
      // How many requests wait in the dashboard for Claude; -1 when the panel cannot see them.
      waiting: number
      busy: Busy
      run: Shaped<Run>
    }
  }
  // The one thing Claude reports to the panel: where the dashboard is.
  interface McpToolInputs {
    'mcp__self-improve__set_dashboard': { url: string }
  }
}
