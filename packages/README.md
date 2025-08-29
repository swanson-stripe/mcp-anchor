# Packages

This directory contains the shim packages for backward compatibility.

## mcp-fixtures-shim

A deprecation shim package that forwards `mcp-fixtures` commands to `mcp-anchor`.

### Purpose

When users run `npx mcp-fixtures`, this shim package:
1. Shows a deprecation warning
2. Forwards all commands to `mcp-anchor`
3. Preserves exact CLI behavior and exit codes

### Publishing

To publish both packages to npm:

```bash
# 1. Build and publish main package
npm run build
npm publish

# 2. Publish shim package  
cd packages/mcp-fixtures-shim
npm publish
```

### Usage After Publishing

Users can continue using the old command:
```bash
npx mcp-fixtures serve
# [deprecation] Use `npx mcp-anchor` instead; forwarding…
# (then runs normally)
```

Or migrate to the new command:
```bash
npx mcp-anchor serve
# (no deprecation warning)
```

### Migration Timeline

1. **Phase 1** (Current): Both packages available, shim shows warnings
2. **Phase 2** (Future): Mark `mcp-fixtures` as deprecated in npm
3. **Phase 3** (Later): Remove `mcp-fixtures` package entirely

This provides a smooth migration path for all existing users.
