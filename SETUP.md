# GW_Flasher — Complete setup and integration guide

This document provides step-by-step instructions to configure `GW-2E3F-2026` (private firmware CI) to publish firmware artifacts and metadata to `aayushnaphade/GW_Flasher` (public flasher site).

Summary
- Two supported integration patterns:
  - Option A: `repository_dispatch` (private CI uploads artifacts to public URLs; public repo downloads them)
  - Option B: Direct push from a separate private publish workflow to `GW_Flasher` using a PAT (private artifacts; pushes files into `firmware/`)

Prerequisites
- Admin or write access to both repos to create secrets.
- A GitHub Personal Access Token (PAT) with `repo` scope for `aayushnaphade/GW_Flasher`.
  - Create at: https://github.com/settings/tokens
  - Scopes: `repo` (or fine-grained token granting write to the specific repo).
- Save the PAT as a repository secret named `PUBLIC_REPO_TOKEN` in `GW-2E3F-2026`.

Environments and secrets
- `GW-2E3F-2026` → Settings → Secrets and variables → Actions → New repository secret
  - Name: `PUBLIC_REPO_TOKEN`
  - Value: <paste PAT>

Option A — repository_dispatch flow (artifacts hosted publicly)

1) Upload artifacts to public URLs (GitHub Release, S3, public CDN).

2) Add a separate publish workflow in the private repo that posts a `repository_dispatch` event. The public repo expects the following keys in `client_payload`:

  - `firmware_url`
  - `bootloader_url`
  - `partition_table_url`
  - `manifest_url`
  - `version_url`

Example (uses `jq`):

```yaml
- name: Notify public flasher
  env:
    PUBLIC_REPO: aayushnaphade/GW_Flasher
    FIRMWARE_URL: https://example.com/path/firmware.bin
    BOOTLOADER_URL: https://example.com/path/bootloader.bin
    PARTITION_URL: https://example.com/path/partition-table.bin
    MANIFEST_URL: https://example.com/path/manifest.json
    VERSION_URL: https://example.com/path/version.json
  run: |
    PAYLOAD=$(jq -n --arg f "$FIRMWARE_URL" --arg b "$BOOTLOADER_URL" --arg p "$PARTITION_URL" --arg m "$MANIFEST_URL" --arg v "$VERSION_URL" '{firmware_url:$f,bootloader_url:$b,partition_table_url:$p,manifest_url:$m,version_url:$v}')
    curl -sSf -X POST \
      -H "Accept: application/vnd.github+json" \
      -H "Authorization: Bearer ${{ secrets.PUBLIC_REPO_TOKEN }}" \
      https://api.github.com/repos/${PUBLIC_REPO}/dispatches \
      -d "{\"event_type\":\"firmware-updated\",\"client_payload\":$PAYLOAD}"
```

3) Verification

- In `aayushnaphade/GW_Flasher` → Actions, confirm `sync-firmware.yml` ran and `firmware/` updated.

Notes
- If your runner lacks `jq`, construct JSON using a short Python snippet.

Option B — direct push from CI (current setup)

1) Ensure `PUBLIC_REPO_TOKEN` secret exists in `GW-2E3F-2026`.

2) Add a separate publish workflow to your private repo (for example, `.github/workflows/publish-public.yml`). Example:

```yaml
- name: Publish to public flasher
  if: ${{ secrets.PUBLIC_REPO_TOKEN != '' }}
  env:
    PUBLIC_REPO: aayushnaphade/GW_Flasher
  run: |
    git config --global user.email "github-actions[bot]@users.noreply.github.com"
    git config --global user.name "github-actions[bot]"
    git clone https://x-access-token:${{ secrets.PUBLIC_REPO_TOKEN }}@github.com/${PUBLIC_REPO}.git public_repo
    mkdir -p public_repo/firmware
    cp -f build/firmware.bin public_repo/firmware/firmware.bin || true
    cp -f build/bootloader.bin public_repo/firmware/bootloader.bin || true
    cp -f build/partition-table.bin public_repo/firmware/partition-table.bin || true
    cat > public_repo/firmware/manifest.json <<'JSON'
{ "builds": [{ "chipFamily": "ESP32-S3", "parts": [ { "offset": "0x0", "path": "bootloader.bin" }, { "offset": "0x8000", "path": "partition-table.bin" }, { "offset": "0x10000", "path": "firmware.bin" } ] } ] }
JSON
    cat > public_repo/firmware/version.json <<'JSON'
{
  "version": "${GITHUB_RUN_NUMBER}",
  "build_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "target": "ESP32-S3"
}
JSON
    cd public_repo
    git add firmware || true
    git commit -m "Update firmware from CI run $GITHUB_RUN_NUMBER" || echo "no changes to commit"
    git push origin main
```

3) Verification

- In `aayushnaphade/GW_Flasher` → Code → main branch, confirm `firmware/` contains updated files.
- The `pages.yml` deploy workflow will run on push and update GitHub Pages.

Manifest format notes
- The `esp-web-install-button` expects a `manifest.json` with a `builds` array. Each build must include `chipFamily` and `parts` (list of `{offset,path}` objects). Adjust offsets to match your build if different.

Step-by-step checklist

1. Create PAT (GitHub → Settings → Developer settings → Personal access tokens).
2. Add `PUBLIC_REPO_TOKEN` to `GW-2E3F-2026` secrets.
3. Choose Option A or B.
4. Trigger the separate publish workflow after a successful build.
5. Leave the run ID blank to use the latest successful build, or set it to publish a specific build.
6. Verify files appear in `aayushnaphade/GW_Flasher/firmware/` and GitHub Pages updates.

Manual test (repository_dispatch)

```bash
curl -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer YOUR_PAT" \
  https://api.github.com/repos/aayushnaphade/GW_Flasher/dispatches \
  -d '{"event_type":"firmware-updated","client_payload": {"firmware_url":"https://.../firmware.bin","bootloader_url":"https://.../boot.bin","partition_table_url":"https://.../partition-table.bin","manifest_url":"https://.../manifest.json","version_url":"https://.../version.json"}}'
```

Security and best practices

- Limit PAT scope to the minimum required. Prefer a fine-grained token granting write only to `aayushnaphade/GW_Flasher`.
- Store PAT as a repository secret and rotate it regularly.
- For extra safety, push to a branch and open a PR instead of pushing directly to `main`.

Troubleshooting

- `403` on push: token lacks `repo` permission or secret misconfigured.
- `sync-firmware.yml` download errors: URL not reachable from Actions; verify access and HTTP status codes.
- Pages not updated: check `pages.yml` Actions logs for deployment errors.

If you want me to change the private workflow to use `repository_dispatch` instead of push, say "switch to dispatch" and I'll add the separate publish workflow in `GW-2E3F-2026/.github/workflows/publish-public.yml`.

End of guide.

