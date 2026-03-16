# CC Companion

A desktop companion app that monitors your Claude Code sessions and serves you curated content while you wait. Built with Electron.

CC Companion sits alongside your workflow, tracking every Claude Code instance running on your machine — which project it's in, whether it's actively working or idle, CPU and memory usage, and how long it's been in each state. When you have a moment between tasks, it serves up a randomized feed of Reddit posts, Hacker News stories, and Substack articles filtered by categories you choose.

## Features

### Claude Code Instance Tracking
- Auto-detects all running Claude Code processes
- Per-instance stats: project name, PID, CPU%, memory, uptime, working/idle duration
- Live working timer that ticks every second
- Click any instance to focus its terminal window in Cursor

### Three View Modes
- **Full Mode** — feed + instance stats + break timer
- **Compact Mode** — stats only, window shrinks to fit just the instance panel
- **Dynamic Island** — a small always-on-top pill bar at the top of your screen showing instance status

### Curated Content Feed
- **Reddit** — posts filtered to 100+ upvotes across 8 categories
- **Hacker News** — top stories from the HN API
- **Substack** — articles with rich previews (title + 500 char body preview) from 20+ newsletters
- **Source filter** — toggle between Substack only, Reddit only, or both
- **Categories** — Comedy, Tech & Dev, Business & Finance, Science & Learning, Visual & Cozy, News & World, Gaming, Design & Creative
- Inline video playback for Reddit video posts
- Every post shows its category, source, score, comment count, and relative time

### Break Timer
- Five break types: Neck Roll, Wrist Stretch, 20-20-20 Eyes, Stand & Stretch, Box Breathing
- Countdown timer with visual feedback

## Download

Grab the latest release from the [Releases](../../releases) page:

| Platform | File |
|----------|------|
| macOS (Apple Silicon) | `CC Companion-x.x.x-arm64.dmg` |
| macOS (Intel) | `CC Companion-x.x.x.dmg` |

Open the `.dmg`, drag CC Companion to your Applications folder, and launch it. That's it.

> **Note:** Since the app isn't signed with an Apple Developer certificate, macOS may block it on first launch. Right-click the app → Open → Open to bypass Gatekeeper.

## Run from Source

If you prefer to run from source or want to contribute:

```bash
git clone https://github.com/jiahongc/cc-companion.git
cd cc-companion
npm install
npm start
```

Requires [Node.js](https://nodejs.org/) v18+.

## Usage

### Instance Monitoring
The status bar at the top shows a summary like "3 total · 1 working". Click it to expand the instance dropdown (open by default). Each row shows:

```
● cc-companion                    02:14    WORKING
  PID 1494 · up 30:48 · CPU 14.5% · 586 MB

○ march-madness-prediction-market idle 05:23  IDLE
  PID 89759 · up 01:05:58 · CPU 0.7% · 883 MB
```

Click any instance row to bring its Cursor terminal window into focus.

### Content Feed
The Random tab shows a mixed feed from your selected categories. Use the controls at the top:

- **edit** — opens the category selector with source filter (Both / Substack / Reddit)
- **shuffle** — clears cache and loads fresh content
- **→** arrow on any category — preview its content before selecting

Reddit posts with fewer than 100 upvotes are filtered out. Substack articles older than 90 days are excluded.

### View Modes
Use the buttons in the bottom bar:

- **Compact** — shrinks the window to just show instance stats (no feed)
- **Island** — switches to a Dynamic Island-style bar at the top of your screen (always-on-top, visible across all apps)

Click the Dynamic Island bar to return to the full window.

### Break Timer
Switch to the Break tab, pick a break type, and hit "start timer". The countdown runs with a visual ring.

## Project Structure

```
cc-companion/
├── electron/
│   ├── main.js          # Electron main process, IPC handlers, window management
│   ├── preload.js       # Context bridge API for renderer
│   ├── tray.js          # System tray icon and menu
│   └── watcher.js       # Claude Code process detection and tracking
├── src/
│   ├── index.html       # Main window
│   ├── styles.css       # All styles
│   ├── app.js           # Main renderer logic, feed fetching, UI
│   ├── compact.html     # Dynamic Island window
│   ├── compact.css      # Dynamic Island styles
│   ├── compact.js       # Dynamic Island renderer
│   └── config/
│       └── defaults.json
├── assets/
│   ├── icon.png         # App icon
│   └── iconTemplate.png # Tray icon
└── package.json
```

## How It Works

### Process Detection
The watcher polls `ps` every 2 seconds to find Claude processes:
```
ps -eo pid,tty,%cpu,%mem,rss,etime,command | grep Claude
```
It resolves each process's working directory via `lsof -d cwd` to get the project name. CPU > 3% = actively working; below that = idle. State transitions (active → idle, idle → active) are timestamped for duration tracking.

### Feed Sources
- **Reddit**: JSON API (`/r/{subreddit}/hot.json`) with User-Agent header. No auth required.
- **Hacker News**: Firebase API (`topstories.json` + individual item fetches). No auth required.
- **Substack**: RSS feeds with `content:encoded` parsing for rich previews. HTML is stripped to plain text.

All feeds are cached for 5 minutes to avoid hammering APIs.

## Build from Source

To package as a standalone `.dmg` / `.exe` / `.AppImage`:

```bash
# macOS
npm run build:mac

# All platforms
npm run build
```

Output goes to the `dist/` folder. The macOS build produces both a `.dmg` installer and a `.zip` archive.

## Configuration

Edit the `CONTENT_CATEGORIES` object in `src/app.js` to add or remove subreddits, Substack feeds, and categories.

Default categories on first launch: Comedy, Tech & Dev, Science & Learning.

## Contributing

1. Fork this repo
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -am 'Add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

## License

MIT
