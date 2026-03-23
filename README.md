# CC Companion

A desktop companion app that monitors your Claude Code sessions and serves you curated content while you wait. Built with Electron.

CC Companion sits alongside your workflow, tracking every Claude Code instance running on your machine — which project it's in, whether it's actively working or idle, CPU and memory usage, token consumption, conversation turns, and how long it's been in each state. When you have a moment between tasks, it serves up a randomized feed of Reddit posts and Substack articles, vocabulary building, or guided break exercises.

## Features

### Claude Code Instance Tracking
- Auto-detects all running Claude Code processes (case-insensitive matching)
- Per-instance stats: project name, git branch, PID, CPU%, memory, uptime, working/idle duration
- **Session analytics**: turn count, input/output token usage, model name — read directly from Claude's session files
- Live working timer that ticks every second
- Click any instance to focus its terminal window in Cursor

### Three Tabs
- **Random** — curated content feed from Reddit and Substack
- **Vocab** — vocabulary builder with pronunciation, definitions, examples, synonyms, and audio playback
- **Break** — guided break timer with five exercise types

### Three View Modes
- **Full Mode** — feed + instance stats + break timer
- **Compact Mode** — stats only, window shrinks to fit just the instance panel
- **Dynamic Island** — a small always-on-top pill bar at the top of your screen showing instance status

### Curated Content Feed
- **Reddit** — posts filtered to 100+ upvotes across 15 categories
- **Substack** — articles with rich previews (title + 500 char body preview) from 70+ newsletters
- **Source filter** — toggle between Substack only, Reddit only, or both
- **Categories** — Comedy, Tech & Dev, Investing & Personal Finance, Science & Learning, Design & Creative, AI & Machine Learning, Startups & Product, News & World, Business & Economics, Gaming, Self-Help & Growth, Visual & Cozy, Productivity & Thinking, Health & Wellness, Crypto & Web3
- **Custom sources** — add your own subreddits or Substack/RSS feeds
- Inline video playback for Reddit video posts
- Every post shows its category, source, score, comment count, and relative time

### Vocabulary Builder
- 1,700+ curated GRE/SAT-level words loaded from a bundled JSON file
- Definitions fetched from the Free Dictionary API (no API key needed)
- Phonetic pronunciation with audio playback
- Definitions grouped by part of speech with example sentences
- Synonyms and antonyms displayed as colored pills
- Fixed "next word" button that doesn't move with content

### Break Timer
- Five break types: Neck Roll, Wrist Stretch, 20-20-20 Eyes, Stand & Stretch, Box Breathing
- Countdown timer with visual feedback
- Pause, resume, and restart controls

### Dark Mode
- Full dark mode toggle via bottom bar button
- Custom dark theme for all components including feed cards and instance rows

## Download

Grab the latest release from the [Releases](../../releases) page:

| Platform | File |
|----------|------|
| macOS (Apple Silicon) | `CC Companion-x.x.x-arm64.dmg` |
| macOS (Intel) | `CC Companion-x.x.x.dmg` |

Open the `.dmg`, drag CC Companion to your Applications folder, and launch it. That's it.

> **Note:** Since the app isn't signed with an Apple Developer certificate, macOS may block it on first launch. Right-click the app > Open > Open to bypass Gatekeeper.

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
● cc-companion · main                         02:14    WORKING
  PID 1494 · up 30:48 · CPU 14.5% · 586 MB
  8 turns  ↑1.1M  ↓5.2k  opus-4-6

○ march-madness · main            idle 05:23    IDLE
  PID 89759 · up 01:05:58 · CPU 0.7% · 883 MB
  27 turns  ↑3.4M  ↓12.1k  opus-4-6
```

- **Turns** = number of user prompts (one prompt + all its tool calls/responses = 1 turn)
- **↑** = total input tokens (including cache reads/writes)
- **↓** = total output tokens
- **Model** = which Claude model the session is using

Click any instance row to bring its Cursor terminal window into focus.

### Content Feed
The Random tab shows a mixed feed from your selected categories. Use the controls at the top:

- **edit** — opens the category selector with source filter (Both / Substack / Reddit)
- **shuffle** — clears cache and loads fresh content
- **→** arrow on any category — preview its content before selecting

Reddit posts with fewer than 100 upvotes are filtered out. Substack articles older than 90 days are excluded.

### Vocabulary
The Vocab tab shows a word card with pronunciation, definitions, example sentences, and synonyms. Hit "next word" (pinned at the bottom) or shuffle for a new word.

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
│   └── watcher.js       # Claude Code process detection, session analytics
├── src/
│   ├── index.html       # Main window
│   ├── styles.css       # All styles (light + dark mode)
│   ├── app.js           # Main renderer logic, feed fetching, vocab, UI
│   ├── vocab-words.json # 1,700+ curated vocabulary words
│   ├── compact.html     # Dynamic Island window
│   ├── compact.css      # Dynamic Island styles
│   └── compact.js       # Dynamic Island renderer
├── assets/
│   ├── icon_1024.png    # App icon (1024x1024 source)
│   ├── icon.icns        # macOS app icon
│   ├── iconTemplate.png # Tray icon
│   └── gen_icon.py      # Icon generation script
└── package.json
```

## How It Works

### Process Detection
The watcher polls `ps` every 2 seconds to find Claude processes (case-insensitive):
```
ps -eo pid,tty,%cpu,%mem,rss,etime,command | grep -i claude
```
It resolves each process's working directory via `lsof -d cwd` to get the project name.

**Activity detection** uses a multi-signal approach with tiered staleness:

1. **JSONL state (primary)** — reads the last entry from Claude's session JSONL to determine ground truth. Some entries are immediately idle (`end_turn`, `system`, `file-history-snapshot`). Active entries get entry-type-specific staleness thresholds:

   | Entry | Staleness | Rationale |
   |-------|-----------|-----------|
   | `assistant(null)` | 10s | Streaming is continuous; 10s silence = interrupted |
   | `assistant(tool_use)` | 5 min | Tools (builds, browser) run long without writes |
   | `progress` | 5 min | Subagents run long without writes |
   | `user` | 2 min | Claude should start responding within 2 min |
   | `queue-operation` | 30s | Quick task notifications |
   | `result` | 30s | Tool output; Claude should pick up quickly |

2. **CPU fallback** — beyond any staleness threshold, if CPU >= 5%, the instance is still treated as active. Also used when no JSONL file exists yet (brand new process).

State transitions (active → idle, idle → active) are timestamped for duration tracking.

### Session Analytics
For each detected instance, the watcher reads:
- `~/.claude/sessions/{pid}.json` — session ID and start time
- `~/.claude/projects/{project-key}/{session-id}.jsonl` — conversation log

From the JSONL it extracts:
- **Turn count** — real user prompts (excludes tool-use results)
- **Token usage** — input, output, cache read, cache creation tokens
- **Model** — which Claude model is active
- **Git branch** — current branch name

Stats refresh every 10 seconds. Only emits updates when data actually changes.

### Feed Sources
- **Reddit**: JSON API (`/r/{subreddit}/hot.json`) with User-Agent header. No auth required.
- **Substack**: RSS feeds with `content:encoded` parsing for rich previews. HTML is stripped to plain text.

All feeds are cached for 5 minutes to avoid hammering APIs.

### Vocabulary
- Word list: 1,700+ curated words bundled in `vocab-words.json`
- Definitions: Free Dictionary API (`dictionaryapi.dev`) — no API key needed
- Returns phonetics, audio pronunciation, definitions, examples, synonyms, antonyms

## Build from Source

To package as a standalone `.dmg`:

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
