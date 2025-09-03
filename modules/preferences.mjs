const DEFAULTS = {
    empty_trash: true,
    empty_junk: false,
    compact_folders: true,
    multi_trash_accounts: "",
    multi_junk_accounts: "",
    multi_compact_folders: "",
    timer_trash_accounts: "",
    timer_junk_accounts: "",
    timer_compact_folders: "",
    timer_interval_enabled: false,
    timer_interval_startup: "0",
    timer_interval_loop: "0",
    timer_absolute_enabled: false,
    timer_absolute: "00:00",
    confirm_single_action: false,
    confirm_multi_action: false,
}

export async function getAllPreferences() {
    const preferences = {}
    for (let name of Object.keys(DEFAULTS)) {
        preferences[name] = await getPreference(name);
    }
    return preferences;
}

export async function getPreference(name) {
    let rv = await browser.storage.local.get({ [`preferences_${name}`]: DEFAULTS[name] });
    let value = rv[`preferences_${name}`];

    if (
        [
            "multi_trash_accounts",
            "multi_junk_accounts",
            "multi_compact_folders",
            "timer_trash_accounts",
            "timer_junk_accounts",
            "timer_compact_folders",
        ].includes(name)
    ) {
        // For convenience, we return the full folder object and ignore folders
        // which no longer exists.
        let folders = [];
        for (let id of value) {
            try {
                let folder = await browser.folders.get(id);
                if (folder) {
                    folders.push(folder);
                } else {
                    console.warn(`XPUNGE: Stored folder with ID ${id} no longer exists`);
                }
            } catch (error) {
                console.warn(`XPUNGE: Error retrieving folder with ID ${id}:`, error);
                // Folder does not exist or is inaccessible, ignore.
            }
        }
        return folders;
    }
    return value;
}

export async function setPreference(name, value) {
    // Add validation for account/folder arrays
    if (
        [
            "multi_trash_accounts",
            "multi_junk_accounts",
            "multi_compact_folders",
            "timer_trash_accounts",
            "timer_junk_accounts",
            "timer_compact_folders",
        ].includes(name)
    ) {
        // Validate that all folders still exist
        let validFolders = [];
        for (let folder of value) {
            try {
                // Check if folder is still accessible
                let folderInfo = await browser.folders.get(folder.id);
                if (folderInfo) {
                    validFolders.push(folder);
                } else {
                    console.info(`XPUNGE: Removing inaccessible folder from ${name}:`, folder.id);
                }
            } catch (error) {
                console.info(`XPUNGE: Removing invalid folder from ${name}:`, folder.id, error);
            }
        }
        return browser.storage.local.set({ [`preferences_${name}`]: validFolders });
    }
    
    return browser.storage.local.set({ [`preferences_${name}`]: value });
}