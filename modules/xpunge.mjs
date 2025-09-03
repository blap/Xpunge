import { getAllPreferences } from "./preferences.mjs"

export async function xpungeAccount(folder) {
    if (!folder.isRoot) {
        return;
    }

    const preferences = await getAllPreferences();
    if (preferences.confirm_single_action) {
        const account = await browser.accounts.get(folder.accountId);
        const dialogTitle = browser.i18n.getMessage("xpunge_single_str_confirm_dialog_title");
        const dialogMsg = browser.i18n.getMessage(
            "xpunge_single_str_confirm_msg_body",
            [
                account != null ? account.name : `${folder.accountId} - UNKNOWN`,
                getYesOrNo(preferences.empty_trash),
                getYesOrNo(preferences.empty_junk),
                getYesOrNo(preferences.compact_folders),
            ]
        );
        if (!await browser.Xpunge.confirm(dialogTitle, dialogMsg)) {
            return;
        }
    }
    // Some of the xpunge action (empty trash and junk) probably do not need to be Experiments.
    if (preferences.empty_junk) { await browser.Xpunge.emptyJunk(folder); }
    if (preferences.empty_trash) { await browser.Xpunge.emptyTrash(folder); }
    if (preferences.compact_folders) { 
        try {
            await browser.Xpunge.compact(folder);
        } catch (error) {
            console.error("XPUNGE: Error during compact operation:", error);
            // Show a more user-friendly error message
            const account = await browser.accounts.get(folder.accountId);
            const accountName = account != null ? account.name : `${folder.accountId} - UNKNOWN`;
            console.info(`XPUNGE: Failed to compact folders for account: ${accountName}. Please ensure the account is properly connected and try again.`);
        }
    }
}

// -----------------------------------------------------------------------------

export async function handleXpungeTimer() {
    const preferences = await getAllPreferences();
    if (preferences.timer_absolute_enabled) {
        // Do not run both timers, if the first one caused an execution already.
        if (await handleAbsoluteTimer(preferences)) {
            return;
        }
    }

    if (preferences.timer_interval_enabled) {
        await handleIntervalTimer(preferences);
    }
}

async function handleAbsoluteTimer(preferences) {
    const stamp = new Date();

    const timeComponents = preferences.timer_absolute.split(":");
    const timer_absolute_hours = timeComponents[0];
    const timer_absolute_minutes = timeComponents[1];

    let hours = 0;
    if (timer_absolute_hours.indexOf("0") === 0) {
        let stripped_hours_pref_value = timer_absolute_hours.substring(1);
        hours = parseInt(stripped_hours_pref_value, 10);
    } else {
        hours = parseInt(timer_absolute_hours, 10);
    }

    let minutes = 0;
    if (timer_absolute_minutes.indexOf("0") === 0) {
        let stripped_minutes_pref_value = timer_absolute_minutes.substring(1);
        minutes = parseInt(stripped_minutes_pref_value, 10);
    } else {
        minutes = parseInt(timer_absolute_minutes, 10);
    }

    if ((hours == stamp.getHours()) && (minutes == stamp.getMinutes())) {
        console.info("XPUNGE: Executing absolute timer expunction");
        doTimer();
        return true;
    }

    return false;
}

async function handleIntervalTimer(preferences) {
    const now = Date.now()

    let {
        lastTimerRun,
        startup
    } = await browser.storage.local.get({
        lastTimerRun: 0,
        startup: 0
    })

    if (
        !checkLoopInterval(preferences.timer_interval_startup) ||
        !checkLoopInterval(preferences.timer_interval_loop)
    ) {
        return;
    }
    const intervalTimer_startup = parseInt(preferences.timer_interval_startup, 10) * 60000;
    const intervalTimer_loop = parseInt(preferences.timer_interval_loop, 10) * 60000;

    // Handle startup expunge.
    if (startup == 0) {
        // Invalid data, set startup to now and exit.
        await browser.storage.local.set({ startup: now });
        return false;
    }
    if (intervalTimer_startup > 0 && now - startup < intervalTimer_startup) {
        // Startup delay has not been reached, exit.
        return false;
    }
    if (intervalTimer_startup > 0 && lastTimerRun == 0) {
        // Startup delay has passed, but timer did not run yet: Execute!
        console.info("XPUNGE: Executing startup timer expunction");
        doTimer();
        return true;
    }

    // Handle interval expunge.
    if (intervalTimer_loop > 0 && now - lastTimerRun > intervalTimer_loop) {
        console.info("XPUNGE: Executing interval timer expunction");
        doTimer();
        return true;
    }
    return false;
}

async function doTimer() {
    const now = Date.now()
    await browser.storage.local.set({ lastTimerRun: now });

    const preferences = await getAllPreferences();
    const junk_folders = preferences.timer_junk_accounts;
    const trash_folders = preferences.timer_trash_accounts;
    const compact_folders = preferences.timer_compact_folders;

    await emptyMultipleJunkFolders(junk_folders);
    await emptyMultipleTrashFolders(trash_folders);
    await compactMultipleFolders(compact_folders);
}

// -----------------------------------------------------------------------------

export async function xpungeMultiple() {
    const preferences = await getAllPreferences();
    const junk_folders = await preferences.multi_junk_accounts;
    const trash_folders = await preferences.multi_trash_accounts;
    const compact_folders = await preferences.multi_compact_folders;

    if (preferences.confirm_multi_action) {
        const dialogTitle = browser.i18n.getMessage("xpunge_multi_str_confirm_dialog_title");
        const dialogMsg = browser.i18n.getMessage(
            "xpunge_multi_str_confirm_msg_body",
            [
                await prettyPrintFolderList(trash_folders),
                await prettyPrintFolderList(junk_folders),
                await prettyPrintFolderList(compact_folders, true),
            ]
        );
        if (!await browser.Xpunge.confirm(dialogTitle, dialogMsg)) {
            return;
        }
    }

    await emptyMultipleJunkFolders(junk_folders);
    await emptyMultipleTrashFolders(trash_folders);
    await compactMultipleFolders(compact_folders);
}

// -----------------------------------------------------------------------------

async function emptyMultipleJunkFolders(folders) {
    for (const folder of folders) {
        try {
            await browser.Xpunge.emptyJunk(folder);
        } catch (error) {
            console.error("XPUNGE: Error emptying junk folder:", error);
            // Continue with other folders even if one fails
        }
    }
}

async function emptyMultipleTrashFolders(folders) {
    for (const folder of folders) {
        try {
            await browser.Xpunge.emptyTrash(folder);
        } catch (error) {
            console.error("XPUNGE: Error emptying trash folder:", error);
            // Continue with other folders even if one fails
        }
    }
}

async function compactMultipleFolders(folders) {
    for (const folder of folders) {
        try {
            await browser.Xpunge.compact(folder);
        } catch (error) {
            console.error("XPUNGE: Error compacting folder:", error);
            // Continue with other folders even if one fails
            // Show a more user-friendly error message
            try {
                const account = await browser.accounts.get(folder.accountId);
                const accountName = account != null ? account.name : `${folder.accountId} - UNKNOWN`;
                if (folder.isRoot) {
                    console.info(`XPUNGE: Failed to compact all folders for account: ${accountName}.`);
                } else {
                    console.info(`XPUNGE: Failed to compact folder on account: ${accountName}.`);
                }
            } catch (e) {
                console.info("XPUNGE: Failed to compact folder - unable to identify account.");
            }
        }
    }
}

// -----------------------------------------------------------------------------

function checkLoopInterval(interval_str) {
    if (interval_str.length <= 0) {
        console.info("XPUNGE: Empty loop timer interval preference");
        return false;
    }

    if (interval_str.search(/[^0-9]/) != -1) {
        console.info("WARNING: Invalid loop timer interval preference:", interval_str);
        return false;
    }
    return true;
}

function getYesOrNo(value) {
    return browser.i18n.getMessage(value ? "xpunge_str_yes" : "xpunge_str_no");
}

async function prettyPrintFolderList(folders, isForCompacting = false) {
    if (folders.length == 0) {
        return ""
    }
    let list = [];
    for (let folder of folders) {
        try {
            let account = await browser.accounts.get(folder.accountId);
            if (folder.isRoot) {
                if (isForCompacting) {
                    list.push(` - ${account.name} ${browser.i18n.getMessage("xpunge_multi_str_compact_whole")}`)
                } else {
                    list.push(` - ${account.name}`)
                }
            } else {
                list.push(` - ${folder.name} @ ${account.name}`)
            }
        } catch (e) {
            let entry = folder.accountId + (isForCompacting ? " - for compacting" : "");
            console.warn(`XPUNGE: An error occurred while pretty printing account/folder (${entry}) while confirming MultiXpunge: ${e.message}`);
        }
    }
    return `\n${list.join("\n")}`;
}