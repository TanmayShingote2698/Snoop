# SNOOP Favicon Documentation

## Overview
The SNOOP exam invigilation system features a custom-designed favicon that represents AI-based exam monitoring, security, and surveillance.

## Design Elements
- **Eye/Camera Lens**: Central element representing monitoring and observation
- **AI Scanning Lines**: Cross-hair pattern indicating active AI surveillance
- **Security Shield Corners**: Corner brackets symbolizing security and protection
- **Monitoring Dots**: Small dots representing continuous monitoring points

## Color Palette
The favicon uses the project's established color scheme:
- **Primary**: `#D410AA` (Pink/Purple gradient)
- **Secondary**: `#dd00ff` (Bright Purple)
- **Background**: `#050505` to `#1a1a1a` (Dark gradient)
- **Accent**: `#00ff41` (Green - for security elements)

## Files Available
- `favicon.svg` - Scalable vector format (recommended)
- `favicon-generator.html` - Interactive tool to generate PNG versions
- `favicon-base64.txt` - Base64 encoded data URI for direct embedding

## Usage
The favicon is automatically included in:
- `layout.ejs` - Main application layout
- `RootPage.ejs` - Landing page

## Generating PNG Versions
1. Open `favicon-generator.html` in a web browser
2. Right-click on the desired size (32x32 or 64x64)
3. Select "Save image as..." to download PNG version
4. Place in the public directory as `favicon-32x32.png` and `favicon-64x64.png`

## Technical Details
- **Format**: SVG with embedded gradients
- **Size**: 64x64 pixels (scalable)
- **Style**: Flat, modern, professional
- **Optimization**: Clear and recognizable at small sizes
- **Compatibility**: Works across all modern browsers

## Integration
The favicon references are automatically added to HTML head sections:
```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="64x64" href="/favicon-64x64.png">
```

This ensures proper display across different devices and browsers.
