# Mingxi 明晰 · Color Accessibility

[中文 README](README.md)

[Privacy Policy](PRIVACY.md) · [Support matrix](docs/support-matrix.md) · [English Store Listing](STORE_LISTING_EN.md)

Mingxi helps people with color vision deficiency understand web content more clearly.

## Features

- Optional color remapping as an assistive layer
- Automatic text and background contrast enhancement
- Text and icon cues for success, warning, and error states
- Underlined links, patterns and data tables for supported inline SVG and Chart.js Canvas charts, and display filters for images and other Canvas content
- Per-site settings and adjustable filter intensity
- A non-standardized color-pattern recognition demo
- Keyboard shortcuts: `Alt + Shift + S` toggles the mode; `Alt + Shift + R` opens reader mode
- Heuristic AA/AAA text contrast diagnostics plus SVG, Canvas, and status coverage counts, with one-click enhancement and JSON report export
- Full JSON settings import/export and recent-use statistics
- Form focus highlighting, context-menu contrast checks, and an extension badge status
- Popup dark mode follows the system preference

## Disclaimer

Mingxi is an accessibility aid, not a medical diagnostic or treatment tool. The color-pattern demo cannot identify a color-vision condition or determine the best mode, and has no medical screening validity. Color presets are visual adjustments to compare by personal preference; they have not been clinically validated.

## Install locally

1. Open `chrome://extensions/` or `edge://extensions/`.
2. Enable Developer mode.
3. Choose **Load unpacked**.
4. Select the `extension/` folder.

For test feedback, export the popup's current-page diagnostic JSON and use the [feature feedback form](.github/ISSUE_TEMPLATE/feature_feedback.yml). Remove account details and personal information before sharing screenshots.

## License

The project code is released under the MIT License. Third-party methods and test resources retain their own licenses; see the in-extension attribution and source links.
