# Use HEARTH on an iPhone

1. Start HEARTH on your Mac and finish household setup on the Mac first.
2. Install Tailscale on the Mac and iPhone. Connect both to your private tailnet, with access restricted to your household.
3. On the Mac, run this one-time access command:

   ```sh
   tailscale serve --bg http://127.0.0.1:4310
   ```

4. Tailscale prints an HTTPS origin for that Mac. In HEARTH Settings → Your kitchen, in your pocket, enter that origin and **Save settings**. Do not enter a path or a token.
5. Scan the QR code with the iPhone or enter the HTTPS address in Safari. Sign in with the household passphrase and choose your profile.
6. In Safari, choose Share → **Add to Home Screen**. Open that installed app for subsequent use.
7. Visit Recipes and Groceries online once so their latest records are cached. Use the grocery page’s large checkboxes while shopping.

A saved address is not proof of reachability. Test the HTTPS address from the phone on cellular data as well as Wi-Fi. The cloud environment cannot perform that physical-device/network check. Do not use Tailscale Funnel or expose a router port. Tailscale itself is configured on the user's Mac; HEARTH does not install a second VPN inside a cloud container.

For a home network without Tailscale, place a trusted HTTPS reverse proxy in front of the loopback backend and restrict its network access. The certificate must be trusted by the iPhone. A raw LAN HTTP address will not satisfy the secure context required by an installable/offline PWA. Tailscale Serve is the supported documented default.

## When the Mac is off

Cached records remain viewable and the app shows an offline banner. Grocery checkoffs, quantities, store assignments, actual-price fields and notes queue in IndexedDB. The UI indicates pending edits. Keep the device cache until synchronization completes. Other operations need the host and do not pretend to succeed offline.

After reconnection, edits replay with their original operation IDs and expected record versions. A conflict stays visible with your exact pending fields. Choose **Apply my edit to latest version** only after reviewing what changed, or explicitly discard your edit. Removed/replaced grocery records require a manual review rather than blind replay.

Only the most recently cached planning week is guaranteed offline. The host does not stay awake automatically: use appropriate Mac power settings. Quitting HEARTH stops the live server; closing its Mac window leaves the app running.
