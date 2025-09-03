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
- **IMPORTANT**: Due to a bug in Thunderbird 140+ (Bugzilla Bug 1977840), Xpunge is not compatible with Thunderbird 140+ yet
- **Maximum supported Thunderbird version is now 139.***

## Compatibility Notes

**IMPORTANT**: Xpunge is not compatible with Thunderbird 140+ due to a bug in Thunderbird that causes an "undefined" error when compacting accounts with unrefreshed junk folders via the WebExtension Experiment API.

**Bug Details** (from Bugzilla Bug 1977840):
- When calling "nsIMsgFolder.compactAll" on an IMAP account with a junk folder that has not been refreshed in the TB folder pane view, an "undefined" error is returned
- The specific error code identified is 2153054245
- The logs show: "BatchCompactor - Can't compact 'imap://xpungetbtest%40gmail.com@imap.gmail.com/[Gmail]/Spam' now. Queued for retry."
- The issue occurs when the junk folder has not been refreshed in the folder pane view
- Once the junk folder is clicked and refreshed, the error does not occur anymore

We have implemented a workaround that attempts to refresh folders before compacting, but this does not completely resolve the issue. Users experiencing this problem should:
1. Click on the junk folder in Thunderbird to refresh it
2. Then run the Xpunge operation

## Exchange Account Support

There are mixed reports about whether emptying trash/junk of Exchange accounts works in TB 128 with Xpunge 5.0.2, and compacting Exchange accounts/folders does not work. We are investigating this issue.

## License

See [license.txt](license.txt) for licensing information.