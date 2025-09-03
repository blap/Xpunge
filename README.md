# Xpunge Thunderbird Extension

Xpunge is a Thunderbird extension that empties the Trash and Junk folders, and compacts folders in multiple Thunderbird accounts.

## Features

- Empty Trash folders
- Empty Junk folders
- Compact folders
- Support for multiple accounts
- Configurable timers for automatic execution
- Multi-account support for batch operations

## Installation

1. Download the latest release `.xpi` file
2. Open Thunderbird
3. Go to Add-ons and Themes
4. Click the gear icon and select "Install Add-on From File"
5. Select the downloaded `.xpi` file

## Building

To build the extension:
1. Clone this repository
2. Run the build script `build.bat` (Windows) or manually package all files into a `.zip` file
3. Rename the extension to `.xpi`

The build script will create a properly packaged extension file named `xpunge-tb.xpi`.

## Configuration

The extension can be configured through Thunderbird's add-on preferences:
- Single account operations
- Multi-account operations
- Timer-based automatic operations

## Localization

The extension supports multiple languages:
- English (en-US)
- Danish (da)
- German (de)
- Greek (el)
- French (fr-FR)
- Italian (it)
- Japanese (ja)
- Russian (ru)

## Updates

### Version 5.1.0 - Manifest V3 Update
- Updated to Manifest V3 for compatibility with Thunderbird 128+
- Replaced browser_action with action API
- Updated folder handling for Manifest V3 compatibility
- Updated minimum Thunderbird version to 128.2.0

## License

See [license.txt](license.txt) for licensing information.