# GW Flasher V2 - Test Checklist

## Pre-Flight Checks

### Browser Compatibility
- [ ] Chrome 89+ installed
- [ ] Edge 89+ installed (optional)
- [ ] Using HTTPS or localhost
- [ ] Web Serial API available (`'serial' in navigator` returns `true`)

### Device Setup
- [ ] ESP32-S3 device available
- [ ] USB cable connected
- [ ] Device powered on
- [ ] Correct drivers installed (CP210x or CH340)

### Files Present
- [ ] `index-v2.html` exists
- [ ] `css/styles-v2.css` exists
- [ ] `js/app-v2.js` exists
- [ ] `js/auth-check.js` exists
- [ ] `firmware/manifest.json` exists
- [ ] `firmware/version.json` exists
- [ ] `firmware/bootloader.bin` exists
- [ ] `firmware/partition-table.bin` exists
- [ ] `firmware/firmware.bin` exists

---

## Visual Tests

### Page Load
- [ ] Page loads without errors
- [ ] No console errors in browser DevTools
- [ ] Fonts load correctly (Inter, JetBrains Mono)
- [ ] Icons display (SVG graphics visible)
- [ ] Color scheme is dark industrial
- [ ] No layout shift during load

### Topbar
- [ ] "GW FLASHER" title visible
- [ ] "Firmware Deployment Utility" subtitle visible
- [ ] Logo icon displays
- [ ] Dark mode button visible (if implemented)
- [ ] Logout button visible
- [ ] 64px height maintained

### Left Panel - Device Status
- [ ] Status dot visible (gray when disconnected)
- [ ] Status dot is 20px diameter
- [ ] "DEVICE DISCONNECTED" label displays
- [ ] Text is 18px, bold
- [ ] Pulsing animation works
- [ ] Background is elevated color (#1f2531)

### Left Panel - Flash Button
- [ ] Button is prominent and large
- [ ] Lightning bolt icon displays (28px)
- [ ] "FLASH FIRMWARE" text is 18px, bold
- [ ] Button is 64px+ tall
- [ ] Gradient background visible
- [ ] Button is disabled (grayed out) initially
- [ ] No glow when disabled

### Left Panel - Firmware Info
- [ ] Six info rows display:
  - [ ] VERSION
  - [ ] BUILD
  - [ ] TARGET
  - [ ] COMMIT
  - [ ] FLASH
  - [ ] STATUS
- [ ] Labels are 10px, uppercase
- [ ] Values are 13px, monospace
- [ ] Compact spacing (8px gaps)
- [ ] Text truncates with ellipsis if too long

### Right Panel - Console
- [ ] Console toolbar visible
- [ ] "SERIAL MONITOR" label displays
- [ ] Status badge shows "DISCONNECTED"
- [ ] CONNECT button visible
- [ ] CLEAR button visible
- [ ] Console output area is large (75% of viewport)
- [ ] Monospace font (JetBrains Mono or Consolas)
- [ ] Dark background (#0d0f14)
- [ ] Placeholder text shows when empty
- [ ] Scrollbar styled correctly

---

## Functional Tests

### Firmware Metadata Loading
- [ ] Open browser DevTools console
- [ ] Refresh page
- [ ] Check for "Firmware metadata loaded" message
- [ ] Verify VERSION updates from "—" to actual version
- [ ] Verify BUILD updates to date
- [ ] Verify TARGET shows "ESP32-S3"
- [ ] Verify COMMIT shows 7-character hash
- [ ] Verify STATUS shows "READY"
- [ ] If error, check firmware/version.json exists

### Flash Button Interaction
- [ ] Hover over flash button
- [ ] Button lifts slightly (transform: translateY(-2px))
- [ ] Gradient reverses
- [ ] Glow intensifies
- [ ] Click flash button
- [ ] Browser port selector opens
- [ ] Select COM port from list
- [ ] ESP Web Tools dialog appears
- [ ] Flashing begins
- [ ] Device status updates to "FLASHING FIRMWARE"
- [ ] Status dot turns amber/yellow
- [ ] Flash completes
- [ ] Device status updates to "FLASH COMPLETE"
- [ ] Status dot turns green

### Serial Monitor - Connect
- [ ] Click CONNECT button
- [ ] Browser port selector opens
- [ ] Select COM port (same as flash or different)
- [ ] Serial monitor connects
- [ ] CONNECT button hides
- [ ] DISCONNECT button appears
- [ ] Console badge changes to "CONNECTED"
- [ ] Badge turns green
- [ ] Initial message appears: "> Serial monitor connected..."
- [ ] Real-time logs start appearing
- [ ] Timestamps prefix each log line [HH:MM:SS]
- [ ] Console auto-scrolls to bottom
- [ ] Scrollbar appears when content overflows

### Serial Monitor - Logs
- [ ] Logs appear in real-time
- [ ] Timestamps are accurate
- [ ] Text wraps correctly
- [ ] Monospace font renders properly
- [ ] No lag or stuttering
- [ ] Can scroll up to see old logs
- [ ] Can select and copy log text
- [ ] Ctrl/Cmd+A selects all logs
- [ ] Ctrl/Cmd+C copies selected text

### Serial Monitor - Clear
- [ ] Click CLEAR button
- [ ] Console empties immediately
- [ ] Placeholder text reappears
- [ ] New logs continue to appear if connected

### Serial Monitor - Disconnect
- [ ] Click DISCONNECT button
- [ ] Serial connection closes
- [ ] DISCONNECT button hides
- [ ] CONNECT button reappears
- [ ] Console badge changes to "DISCONNECTED"
- [ ] Badge turns gray
- [ ] Message appears: "> Serial monitor disconnected"
- [ ] No more logs appear
- [ ] Old logs remain visible (not cleared)

---

## Interaction Tests

### Keyboard Navigation
- [ ] Press Tab key
- [ ] Focus moves to logout button
- [ ] Press Tab again
- [ ] Focus moves to flash button
- [ ] Flash button has visible focus indicator
- [ ] Press Tab again
- [ ] Focus moves to CONNECT button
- [ ] Press Enter/Space on focused button
- [ ] Button activates correctly

### Mouse Interactions
- [ ] Hover over flash button shows hover state
- [ ] Hover over console buttons shows hover state
- [ ] Click flash button triggers port selector
- [ ] Click CONNECT triggers port selector
- [ ] Click CLEAR empties console
- [ ] Click DISCONNECT closes serial port
- [ ] Click logout button logs out (or shows alert)

### Touch Interactions (Mobile/Tablet)
- [ ] Tap flash button works
- [ ] Tap console buttons work
- [ ] Console scrolls with touch
- [ ] No hover states stick on touch devices

---

## Responsive Tests

### Desktop (1920x1080)
- [ ] Left panel is 320px wide
- [ ] Right panel fills remaining space (~1600px)
- [ ] Console is ~800px tall
- [ ] All elements visible without scrolling
- [ ] No horizontal scrollbar

### Laptop (1366x768)
- [ ] Layout still two-column
- [ ] Console slightly shorter but still usable
- [ ] All elements visible
- [ ] No critical content cut off

### Tablet (1024x768)
- [ ] Layout switches to single column (stacked)
- [ ] Device status at top
- [ ] Flash button below
- [ ] Console takes remaining height
- [ ] Console still 60%+ of screen

### Mobile (375x667)
- [ ] Single column layout
- [ ] Device status compact
- [ ] Flash button smaller but still prominent
- [ ] Console scrollable
- [ ] All functions work

---

## Performance Tests

### Page Load Performance
- [ ] Open DevTools → Network tab
- [ ] Hard refresh (Ctrl+Shift+R)
- [ ] Total page size < 20KB
- [ ] Load time < 200ms (localhost)
- [ ] No render-blocking resources
- [ ] Fonts load without FOIT/FOUT

### Runtime Performance
- [ ] Open DevTools → Performance tab
- [ ] Start recording
- [ ] Interact with page (flash, connect, logs)
- [ ] Stop recording
- [ ] Frame rate stays 60fps
- [ ] No long tasks (>50ms)
- [ ] Memory usage stable (~10-15MB)
- [ ] No memory leaks

### Console Performance
- [ ] Connect serial monitor
- [ ] Let device log heavily (100+ lines/second)
- [ ] Console updates smoothly
- [ ] Auto-scroll works without lag
- [ ] CPU usage < 30%
- [ ] After 1000 lines, old lines are trimmed
- [ ] No crash or freeze

---

## Error Handling Tests

### Firmware Metadata Error
- [ ] Rename `firmware/version.json` to `_version.json`
- [ ] Refresh page
- [ ] Check console for error message
- [ ] VERSION shows "ERROR"
- [ ] BUILD shows "ERROR"
- [ ] Other fields show "—"
- [ ] Page still functions
- [ ] Rename file back
- [ ] Refresh
- [ ] Metadata loads correctly

### Web Serial Not Supported
- [ ] Open page in Firefox
- [ ] Console badge shows "NOT SUPPORTED"
- [ ] CONNECT button is disabled
- [ ] Error message in console output
- [ ] Flash button still visible but may not work

### Port Selection Cancelled
- [ ] Click CONNECT
- [ ] Click Cancel in port selector
- [ ] No error thrown
- [ ] Button state reverts
- [ ] Console shows no error

### Device Disconnected Mid-Flash
- [ ] Start flashing firmware
- [ ] Unplug device during flash
- [ ] Error message appears
- [ ] Device status shows "FLASH FAILED"
- [ ] Status dot turns red
- [ ] Console logs the error

### Device Disconnected Mid-Monitor
- [ ] Connect serial monitor
- [ ] Unplug device
- [ ] Serial connection closes
- [ ] Error appears in console
- [ ] CONNECT button reappears
- [ ] No crash

---

## Accessibility Tests

### Color Contrast
- [ ] Use browser DevTools color picker
- [ ] Check text-primary on bg-primary ratio (should be >14:1)
- [ ] Check text-secondary on bg-primary ratio (should be >7:1)
- [ ] Check text-muted on bg-primary ratio (should be >4.5:1)
- [ ] Check accent color on backgrounds
- [ ] All critical text meets WCAG AA

### Focus Indicators
- [ ] Tab through all interactive elements
- [ ] Each element has visible focus indicator
- [ ] Focus indicator has sufficient contrast
- [ ] Focus order is logical (top to bottom, left to right)

### Screen Reader (Optional)
- [ ] Enable screen reader (NVDA, JAWS, VoiceOver)
- [ ] Navigate page with keyboard
- [ ] All buttons are announced
- [ ] Status changes are announced (if aria-live used)
- [ ] Form fields are labeled (if added later)

---

## Browser-Specific Tests

### Chrome
- [ ] All features work
- [ ] Web Serial API available
- [ ] No console errors
- [ ] Performance is good

### Edge (Chromium)
- [ ] All features work
- [ ] Web Serial API available
- [ ] No console errors
- [ ] Performance is good

### Opera
- [ ] All features work (if available)
- [ ] Web Serial API available
- [ ] No console errors

### Firefox
- [ ] Page loads
- [ ] Error message about Web Serial
- [ ] No crash
- [ ] UI still looks correct

### Safari
- [ ] Page loads
- [ ] Error message about Web Serial
- [ ] No crash
- [ ] UI still looks correct

---

## Security Tests

### HTTPS Requirement
- [ ] Load page over HTTP (if possible)
- [ ] Web Serial should not work
- [ ] Error message explains HTTPS required

### Port Selection Sandboxing
- [ ] Click CONNECT
- [ ] Verify user must manually select port
- [ ] Page cannot auto-connect without permission
- [ ] Each connection requires user action

---

## Edge Cases

### Very Long Logs
- [ ] Generate 10,000+ lines of logs
- [ ] Check that only last 1000 are kept
- [ ] No memory leak
- [ ] No slowdown

### Very Wide Log Lines
- [ ] Send log with 1000+ characters
- [ ] Line wraps correctly
- [ ] Horizontal scrollbar appears in console
- [ ] No layout break

### Rapid Flashing
- [ ] Flash device
- [ ] Immediately flash again
- [ ] No error
- [ ] Both flashes complete

### Rapid Connect/Disconnect
- [ ] Connect monitor
- [ ] Immediately disconnect
- [ ] Repeat 10 times rapidly
- [ ] No error
- [ ] No memory leak

### Multiple Tabs
- [ ] Open V2 in two browser tabs
- [ ] Flash from one tab
- [ ] Monitor from other tab
- [ ] Both work independently
- [ ] No interference

---

## Comparison with V1

### Side-by-Side Visual
- [ ] Open V1 (`index.html`) in one window
- [ ] Open V2 (`index-v2.html`) in another
- [ ] Compare device status visibility (V2 should be 3x larger)
- [ ] Compare flash button size (V2 should be 2x larger)
- [ ] Compare console size (V2 should be 4x larger)
- [ ] Compare metadata density (V2 should be 4x more compact)

### Workflow Speed
- [ ] Time how long to flash in V1 (from page load to flash start)
- [ ] Time how long to flash in V2 (from page load to flash start)
- [ ] V2 should be 3-5 seconds faster

---

## Documentation Validation

### README Accuracy
- [ ] Follow V2_QUICK_START.md instructions
- [ ] All steps work as described
- [ ] No missing steps
- [ ] No incorrect information

### Code Comments
- [ ] Open `js/app-v2.js`
- [ ] Check that functions have comments
- [ ] Comments match actual behavior

### File Structure
- [ ] Verify all files mentioned in docs exist
- [ ] Verify file paths are correct
- [ ] Verify no extra files mentioned

---

## Final Checklist

### Before Deployment
- [ ] All visual tests pass
- [ ] All functional tests pass
- [ ] All performance tests pass
- [ ] All error handling tests pass
- [ ] No console errors
- [ ] No console warnings
- [ ] Documentation is complete
- [ ] README is accurate

### Deploy Checklist
- [ ] Files uploaded to server/GitHub
- [ ] HTTPS enabled
- [ ] Firmware files present
- [ ] Test from deployed URL
- [ ] Share URL with testers

### Post-Deployment
- [ ] Monitor for errors
- [ ] Gather user feedback
- [ ] Track usage metrics (if implemented)
- [ ] Iterate based on feedback

---

## Bug Report Template

If you find issues, document:

```
Browser: Chrome 120 / Edge 119 / etc.
OS: Windows 11 / macOS 14 / etc.
Device: ESP32-S3 / ESP32-C3 / etc.
Issue: Clear description of problem
Steps to reproduce:
1. Step one
2. Step two
3. Step three
Expected: What should happen
Actual: What actually happened
Console errors: Copy any errors from DevTools
Screenshots: Attach if helpful
```

---

## Success Criteria

V2 is successful if:
- ✅ Device status is immediately visible
- ✅ Flash button is obviously the primary action
- ✅ Console takes 70%+ of screen
- ✅ Metadata is compact but readable
- ✅ Workflow is faster than V1
- ✅ Engineers prefer it over V1
- ✅ No critical bugs

If all tests pass, V2 is ready for production use.
