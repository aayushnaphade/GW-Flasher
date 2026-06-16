# GW Flasher V2 - Layout Guide

## Screen Layout (1920x1080 reference)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  GW FLASHER                                          [Dark mode]  [Logout]   │ ← 64px
│  Firmware Deployment Utility                                                 │
├───────────────────┬──────────────────────────────────────────────────────────┤
│                   │                                                          │
│  ●  ESP32-S3      │  > SERIAL MONITOR            [DISCONNECTED]             │
│     CONNECTED     │                                  [CONNECT] [CLEAR]       │ ← 48px
│     COM5          │  ─────────────────────────────────────────────────────── │
│                   │                                                          │
│ ╔═══════════════╗ │  > Ready for serial connection                          │
│ ║               ║ │  > Connect device to start monitoring                   │
│ ║      ⚡       ║ │                                                          │
│ ║     FLASH     ║ │  [12:01:22] ESP-ROM:esp32s3-20210327                   │
│ ║   FIRMWARE    ║ │  [12:01:22] Build:Mar 27 2021                          │
│ ║               ║ │  [12:01:22] rst:0x1 (POWERON),boot:0x8 (SPI_FAST...)   │
│ ╚═══════════════╝ │  [12:01:23] SPIWP:0xee                                 │ 
│                   │  [12:01:23] mode:DIO, clock div:1                       │
│ VERSION           │  [12:01:23] load:0x3fce3808,len:0x44c                  │
│ v3.0.0            │  [12:01:23] load:0x403c9700,len:0xbe4                  │
│                   │  [12:01:24] entry 0x403c98d4                            │
│ BUILD             │  [12:01:24] I (27) boot: ESP-IDF v5.0 2nd stage...     │
│ 2026-06-17        │  [12:01:24] I (27) boot: chip revision: 0              │
│                   │  [12:01:25] I (30) boot.esp32s3: SPI Speed: 80MHz     │
│ TARGET            │  [12:01:25] I (35) boot.esp32s3: SPI Mode: DIO         │
│ ESP32-S3          │  [12:01:25] I (40) boot.esp32s3: SPI Flash Size: 8MB   │
│                   │  [12:01:26] I (44) boot: Enabling RNG early entropy... │
│ COMMIT            │  [12:01:26] I (50) boot: Partition Table:              │
│ abc1234           │  [12:01:26] I (53) boot: ## Label     Usage   Type...  │
│                   │  [12:01:27] I (61) boot:  0 nvs       WiFi     data... │
│ FLASH             │  [12:01:27] I (68) boot:  1 phy_init  RF       data... │
│ 8MB               │  [12:01:27] I (76) boot:  2 factory   factory  app...  │
│                   │  [12:01:28] I (83) boot: End of partition table         │
│ STATUS            │  [12:01:28] I (88) esp_image: segment 0: paddr=0x00... │
│ READY             │  [12:01:29] I (101) esp_image: segment 1: paddr=0x0... │
│                   │  [12:01:29] I (124) esp_image: segment 2: paddr=0x0... │
│                   │  [12:01:30] I (142) esp_image: segment 3: paddr=0x0... │
│                   │  [12:01:30] I (157) esp_image: segment 4: paddr=0x0... │
│                   │  [12:01:31] I (189) boot: Loaded app from partition... │
│                   │  [12:01:31] I (189) boot: Disabling RNG early entropy │
│                   │  [12:01:32] I (203) cpu_start: Pro cpu up.             │
│                   │  [12:01:32] I (207) cpu_start: Starting app cpu...     │
│                   │  [12:01:33] I (223) cpu_start: Pro cpu start user...  │
│                   │  [12:01:33] I (223) cpu_start: cpu freq: 160000000    │
│                   │  [12:01:34] I (223) cpu_start: Application running..  │
│                   │  [12:01:34] I (227) heap_init: Initializing. RAM...   │
│                   │  [12:01:35] I (234) heap_init: At 3FC9B6E8 len 000... │
│                   │  [12:01:35] I (240) heap_init: At 3FCE0000 len 000... │
│                   │  [12:01:36] I (257) spi_flash: detected chip: gd      │
│                   │  [12:01:36] I (262) spi_flash: flash io: dio          │
│                   │  [12:01:37] W (265) spi_flash: Detected size(16384k.. │
│                   │  [12:01:37] I (275) cpu_start: Starting scheduler..   │
│                   │  [12:01:38] I (280) main_task: Started on CPU0        │
│                   │  [12:01:38] I (290) main_task: Calling app_main()     │
│                   │                                                          │
└───────────────────┴──────────────────────────────────────────────────────────┘
   320px                              ~1600px
```

## Dimensions

### Viewport
- **Total Height**: 100vh (minus 64px topbar = remaining for workspace)
- **Total Width**: 100vw

### Layout Grid
- **Left Panel**: 320px fixed width
- **Right Panel**: Flexible (1fr = remaining space)

### Left Panel Breakdown
```
┌─────────────────────┐
│ Device Status       │ ← 100px (with padding)
├─────────────────────┤
│                     │
│   Flash Button      │ ← 120px (large CTA)
│                     │
├─────────────────────┤
│ Firmware Info       │ ← Flexible, auto-height
│ • VERSION           │   (6 rows × ~32px = 192px)
│ • BUILD             │
│ • TARGET            │
│ • COMMIT            │
│ • FLASH             │
│ • STATUS            │
└─────────────────────┘
```

### Right Panel (Console)
```
┌───────────────────────────────┐
│ Toolbar                       │ ← 48px fixed
├───────────────────────────────┤
│                               │
│                               │
│   Console Output              │ ← Flexible (fills remaining)
│   (flex: 1)                   │
│                               │
│                               │
└───────────────────────────────┘
```

## Responsive Breakpoints

### Desktop (1024px+)
- Two-column layout (320px + flex)
- Full console height
- All features visible

### Tablet (1024px and below)
```
┌─────────────────────┐
│ Device Status       │
│ Flash Button        │
│ Firmware Info       │
├─────────────────────┤
│                     │
│ Console             │
│                     │
└─────────────────────┘
```
- Stack vertically
- Left panel becomes top panel
- Console takes remaining height

## Color Zones

```
┌──────────────────────────────────────┐
│  #13161d (bg-secondary)              │ ← Topbar
├──────────────┬───────────────────────┤
│ #13161d      │ #0d0f14               │
│ (secondary)  │ (primary)             │
│              │                       │
│ ┌──────────┐│                       │
│ │ #1f2531  ││ Console bg            │
│ │(elevated)││ + subtle grid         │
│ └──────────┘│                       │
│              │                       │
└──────────────┴───────────────────────┘
```

## Typography Scale

### Headers
- **Device Status Label**: 18px / 700 weight / 0.02em tracking
- **Flash Button Text**: 18px / 700 weight / 0.08em tracking
- **Section Labels**: 11px / 600 weight / 0.1em tracking (UPPERCASE)

### Body
- **Status Details**: 14px / 400 weight / monospace
- **Info Values**: 13px / 500 weight / monospace
- **Console Output**: 13px / 400 weight / monospace / 1.7 line-height
- **Info Keys**: 10px / 600 weight / 0.08em tracking (UPPERCASE)

## Spacing System

### Padding Values
```
Device Status Panel:    24px all sides
Flash Section:          24px all sides
Info Section:           16px horizontal, 16px vertical
Console Toolbar:        12px vertical, 16px horizontal
Console Output:         16px all sides
```

### Gap Values
```
Device Status Elements:  16px gap
Flash Button Internal:   12px gap
Info Rows:               8px gap
Info Key-Value:          8px gap
Console Controls:        8px gap
```

## Border System

### Border Widths
- **Primary Borders**: 1px (between panels, sections)
- **Console Toolbar**: 2px bottom border (emphasis)
- **Flash Button**: 2px (when focused/active)

### Border Colors
- **Default**: `#2a303e` (--border)
- **Light**: `#373e50` (--border-light, on hover)
- **Accent**: `#00d991` (active states)

## Shadow System

### Flash Button
```css
/* Default */
box-shadow: 0 4px 16px rgba(0, 217, 145, 0.3);

/* Hover */
box-shadow: 0 6px 24px rgba(0, 217, 145, 0.4);

/* Active */
box-shadow: 0 2px 8px rgba(0, 217, 145, 0.3);

/* Disabled */
box-shadow: none;
```

### Status Dot (Connected)
```css
box-shadow: 0 0 12px rgba(34, 197, 94, 0.6);
```

## Icon Sizes

- **Flash Button Icon**: 28px
- **Console Toolbar Icon**: 14px
- **Button Icons**: 12px
- **Topbar Logo**: 24px
- **Status Dot**: 20px

## Z-Index Layers

```
Topbar:           z-index: 100
Flash Button:     z-index: 1 (default)
Console Toolbar:  z-index: 2 (above console)
Scrollbar:        z-index: 3 (above content)
```

## Animation Timings

```css
/* Fast interactions */
button transitions:     0.15s ease

/* Slow ambience */
status dot pulse:       2s ease-in-out infinite
flash button glow:      3s ease-in-out infinite
badge pulse:            2s ease-in-out infinite
```

## Console Specifics

### Grid Pattern Background
```css
background-image: 
  linear-gradient(rgba(255, 255, 255, 0.01) 1px, transparent 1px),
  linear-gradient(90deg, rgba(255, 255, 255, 0.01) 1px, transparent 1px);
background-size: 20px 20px;
```

### Log Format
```
[HH:MM:SS] Log message here
> System message (no timestamp)
```

### Scrollbar
- Width: 12px
- Track: `#0d0f14` with 1px left border
- Thumb: `#373e50` (no border radius)
- Hover: `#6c7689`

## State Indicators

### Device Status Dot
```
disconnected → gray     (pulsing)
connected    → green    (glowing, steady)
flashing     → amber    (glowing)
error        → red      (glowing)
```

### Console Badge
```
DISCONNECTED → gray background
CONNECTED    → green background with pulse
```

### Flash Button
```
disabled     → gray background, muted text
enabled      → gradient, glowing, pulsing
hover        → brighter, lifted
active       → pressed down
```

## Accessibility

### Focus States
All interactive elements have visible focus indicators:
- Buttons: 2px accent border
- Inputs: 2px accent border (if added later)

### Contrast Ratios
- Text on dark bg: 14:1 (excellent)
- Muted text: 7:1 (good)
- Status colors: 5:1+ (good)

### Keyboard Navigation
- Tab order: Device status → Flash → Console controls
- Enter/Space: Activate buttons
- Escape: Close modals (if added)

## Performance

### Layout Shifts
- Fixed heights for topbar (64px) and console toolbar (48px)
- Prevents CLS during load

### Paint Optimization
- CSS containment on console
- Transform for button animations (GPU)
- Will-change on animated elements

### Scroll Performance
- Passive scroll listeners
- Virtual scrolling not needed (logs limited to 1000 lines)
- Debounced auto-scroll

## Print Styles (Future)

If users need to print logs:
```css
@media print {
  .topbar, .flash-section, .info-section { display: none; }
  .console-output { 
    background: white; 
    color: black; 
    font-size: 10pt; 
  }
}
```

## Dark Mode Only

Currently, the tool only supports dark mode because:
1. Engineering tools are primarily used in dark environments
2. Reduces eye strain during long sessions
3. Better for OLED screens
4. Matches typical development environments

Light mode could be added, but dark mode should remain the default.
