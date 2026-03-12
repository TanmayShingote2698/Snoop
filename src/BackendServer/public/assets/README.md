# Assets Folder

This folder contains static assets for the SNOOP application.

## Structure

```
assets/
├── favicon/
│   ├── favicon.svg              # Main SVG favicon (scalable)
│   ├── favicon-32x32.png        # PNG favicon for small sizes
│   ├── favicon-64x64.png        # PNG favicon for larger sizes
│   ├── favicon-generator.html     # Interactive favicon generator tool
│   ├── favicon-base64.txt        # Base64 encoded favicon data
│   └── README-FAVICON.md       # Favicon documentation and usage guide
└── README.md                   # This file
```

## Favicon

The favicon represents AI-based exam monitoring with:
- **Eye/Camera lens** - Represents monitoring and observation
- **Scanning crosshairs** - Indicates active AI surveillance
- **Security shield corners** - Symbolizes exam security and protection
- **Project color scheme** - Uses established purple/green theme

### Usage
Favicon files are automatically referenced in HTML templates:
- `/assets/favicon/favicon.svg` - Main SVG format
- `/assets/favicon/favicon-32x32.png` - 32x32 PNG format
- `/assets/favicon/favicon-64x64.png` - 64x64 PNG format

### Browser Support
- **SVG**: Modern browsers, scalable vector format
- **PNG**: Fallback for older browsers and specific size requirements

## Adding New Assets

Place new static assets in appropriate subfolders:
- Images: `assets/images/`
- Icons: `assets/icons/`
- Scripts: `assets/js/`
- Styles: `assets/css/`

Update HTML templates to reference new asset paths accordingly.
