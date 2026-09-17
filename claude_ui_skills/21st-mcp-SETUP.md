# 21st MCP — setup

The config below is exactly what `npx @21st-dev/cli@latest init --client claude`
emits. I ran that command in a scratch container to read its output, so this is
the tool's own config, not a guess. It's already written for you as `mcp.json`.

## 1. Put the config in your project

Copy `mcp.json` to the root of a project as `.mcp.json` (note the leading dot):

    copy E:\claude_skills\mcp.json C:\path\to\your-project\.mcp.json

If the project already has a `.mcp.json`, merge the `"21st"` entry into its
existing `mcpServers` object rather than overwriting the file.

```json
{
  "mcpServers": {
    "21st": {
      "type": "http",
      "url": "https://21st.dev/api/mcp",
      "headers": {
        "x-api-key": "${API_KEY_21ST}"
      }
    }
  }
}
```

## 2. Set your API key

The config reads the key from an environment variable, so the key itself never
goes into a file you might commit. Get one from your account at 21st.dev, then:

    setx API_KEY_21ST "your-key-here"

Open a new terminal afterwards — `setx` only affects sessions started after it.

## 3. Restart Claude Code

It reads `.mcp.json` at startup. Check the server is live with `/mcp`.

## Notes

- Free tier: search and publish are free, installs are limited to two a day,
  and AI generation uses separate credits.
- The CLI can also write this for you: `npx @21st-dev/cli@latest init --client claude --write`
  Valid `--client` values are `cursor`, `claude`, `codex`, `vscode`, `devin`
  (`windsurf` is accepted as an alias for `devin`).
- The service was formerly Magic MCP; the `@21st-dev/magic` package still works.
