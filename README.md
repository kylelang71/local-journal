# Local Journal

A locally hosted, password-protected journalling application with rich text editing.

## Requirements

- **Node.js v18 or later**
- A modern web browser (Chrome, Firefox, Safari)

## Quick Start

```bash
cd "Local Host Journal"
npm install
npm start
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

On first launch, you'll be prompted to set a password. After that, you'll be taken directly to your journal.

## Running as a Background Service (macOS)

The server can be registered as a macOS LaunchAgent so it starts automatically at login and restarts itself if it ever crashes. The plist is already installed at `~/Library/LaunchAgents/com.kylelang.localjournal.plist`.

**Activate / deactivate**

```bash
# Load and start (run once after first install, or after any plist edits)
launchctl load ~/Library/LaunchAgents/com.kylelang.localjournal.plist

# Stop and unload
launchctl unload ~/Library/LaunchAgents/com.kylelang.localjournal.plist

# Restart
launchctl unload ~/Library/LaunchAgents/com.kylelang.localjournal.plist && \
launchctl load  ~/Library/LaunchAgents/com.kylelang.localjournal.plist
```

**Check status** (a non-zero PID in the second column means it's running)

```bash
launchctl list | grep localjournal
```

**View logs**

```bash
tail -f ~/Library/Logs/LocalJournal/server.log        # stdout
tail -f ~/Library/Logs/LocalJournal/server-error.log  # stderr
```

## Configuration

Settings are stored at `~/.localjournal/config.json`. You can also change them from within the app at `/settings`:

| Setting | Default | Description |
|---------|---------|-------------|
| Journal directory | `~/Journal/` | Where `.html` entry files are saved |
| Session duration | 24 hours | How long your login stays active |
| Default sort | Modified date | How entries are ordered in the sidebar |
| Font size | 16px | Editor body text size |

## Journal files

Each entry is stored as an `.html` file with YAML metadata in an HTML comment at the top:

```html
<!--
title: Morning Thoughts
created: 2026-02-27T08:30:00-07:00
modified: 2026-02-27T09:14:00-07:00
pinned: false
-->

<h1>Morning Thoughts</h1>
<p>Today I woke up feeling <mark style="background-color:#FDE68A">energized</mark>…</p>
```

Images are copied to `~/Journal/_assets/` and referenced by relative path.

Deleted entries are moved to `~/Journal/.trash/` (not permanently deleted).

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘/Ctrl + B` | Bold |
| `⌘/Ctrl + I` | Italic |
| `⌘/Ctrl + U` | Underline |
| `⌘/Ctrl + Shift + X` | Strikethrough |
| `⌘/Ctrl + Shift + H` | Highlight (last color) |
| `⌘/Ctrl + Shift + C` | Open font color picker |
| `⌘/Ctrl + Shift + 1/2/3` | Title / Heading / Subheading |
| `⌘/Ctrl + Shift + 0` | Body paragraph |
| `⌘/Ctrl + Shift + 7/8` | Numbered / Bulleted list |
| `⌘/Ctrl + K` | Insert / edit link |
| `⌘/Ctrl + N` | New entry |
| `⌘/Ctrl + S` | Force save |
| `Tab / Shift+Tab` | Indent / outdent |

## Development

```bash
npm run dev   # Start with --watch (auto-restart on file changes)
```

Change the port by setting the `PORT` environment variable (copy `.env.example` to `.env`).
