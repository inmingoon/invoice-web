# Blocks Edit/Write attempts on sensitive files.
# Wired via .claude/settings.json -> PreToolUse hook on Edit|Write|NotebookEdit.
# Exit code 2 tells Claude Code to reject the tool call and surface stderr.

param()

$path = $env:CLAUDE_TOOL_INPUT_FILE_PATH
if (-not $path) { exit 0 }

# Normalize to forward slashes so the regex is simpler
$norm = $path -replace '\\', '/'

# Match either at the start of the path or after a slash, then a protected name.
# Covers: .env, .env.local, .env.production, .env.example, ... and package-lock.json
$pattern = '(^|/)(\.env(\..*)?|package-lock\.json)$'

if ($norm -match $pattern) {
    Write-Error "BLOCKED: '$path' is protected. Ask the user to edit it manually, or use the right tool (npm install regenerates package-lock.json; .env files hold secrets)."
    exit 2
}

exit 0
