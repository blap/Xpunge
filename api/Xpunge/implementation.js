var { FolderUtils } = ChromeUtils.importESModule(
  "resource:///modules/FolderUtils.sys.mjs"
);
var { VirtualFolderHelper } = ChromeUtils.importESModule(
  "resource:///modules/VirtualFolderWrapper.sys.mjs"
);
var { MailServices } = ChromeUtils.importESModule(
  "resource:///modules/MailServices.sys.mjs"
);
var { Components, Services } = ChromeUtils.importESModule(
  "resource://gre/modules/Services.sys.mjs"
);
var { ExtensionCommon } = ChromeUtils.importESModule(
  "resource://gre/modules/ExtensionCommon.sys.mjs"
);

const Cr = Components.results;

class UrlListener {
  constructor() {
    this.PromiseWithResolvers = Promise.withResolvers();
  }
  OnStartRunningUrl() {}
  OnStopRunningUrl(url, exitCode) {
    if (Components.isSuccessCode(exitCode)) {
      this.PromiseWithResolvers.resolve();
    } else {
      this.PromiseWithResolvers.reject(exitCode); // Fix Bugzilla Bug 1977840 - Pass the error code
    }
  }
  isDone() {
    return this.PromiseWithResolvers.promise
  }
}

var Xpunge = class extends ExtensionCommon.ExtensionAPI {
  getAPI(context) {
    return {
      Xpunge: {
        async confirm(dialogTitle, dialogMsg) {
          	// Show a confirmation dialog. For the first argument, supply the parent window. The second
	          // argument is the dialog title and the third argument is the message to display.
	          let w = Services.wm.getMostRecentWindow("mail:3pane");
	          return Services.prompt.confirm(w, dialogTitle, dialogMsg);
        },
        // Empty junk of the account belonging to the specified folder.
        async emptyJunk(folder) {
          const rootFolder = context.extension.folderManager.get(
            folder.accountId,
            folder.path
          ).rootFolder;
      
          const _emptyJunk = async (nativeFolder) => {
            if (FolderUtils.isSmartVirtualFolder(nativeFolder)) {
              // This is the unified junk folder.
              const wrappedFolder = VirtualFolderHelper.wrapVirtualFolder(nativeFolder);
              for (const searchFolder of wrappedFolder.searchFolders) {
                await _emptyJunk(searchFolder);
              }
              return;
            }
          
            // Delete any subfolders this folder might have
            for (const subFolder of nativeFolder.subFolders) {
              nativeFolder.propagateDelete(subFolder, true);
            }
          
            const messages = [...nativeFolder.messages];
            if (!messages.length) {
              return;
            }
          
            // Now delete the messages
            await new Promise((resolve, reject) => {
              nativeFolder.deleteMessages(
                messages, 
                null, // msgWindow
                true, // deleteStorage,
                false, // isMove
                {
                  /** @implements {nsIMsgCopyServiceListener} */
                  onStartCopy() {},
                  onProgress() {},
                  setMessageKey() {},
                  getMessageId() {
                    return null;
                  },
                  onStopCopy(status) {
                    if (status == Cr.NS_OK) {
                      resolve();
                    } else {
                      reject(status);
                    }
                  },
                },
                false, // allowUndo
              )
            });
          }

          const junkFolders = rootFolder.getFoldersWithFlags(Ci.nsMsgFolderFlags.Junk);
          for (let junkFolder of junkFolders) {
            try {
              console.info("XPUNGE: Emptying junk folder (", junkFolder.prettyName, ") for account:", rootFolder.server.prettyName);
              await _emptyJunk(junkFolder);
              console.info("XPUNGE: Done");

            } catch (ex) {
              console.info("XPUNGE: Failed emptying junk folder:", junkFolder.prettyName, ex);
            }
          }

        },
        // Empty trash of the account belonging to the specified folder.
        async emptyTrash(folder) {
          const rootFolder = context.extension.folderManager.get(
            folder.accountId,
            folder.path
          ).rootFolder;

          const _emptyTrash = async (folder) => {
            if (["none", "rss", "pop3", "owl"].includes(folder.server.type)) {
              // The implementation of nsMsgLocalMailFolder::EmptyTrash does not call the
              // urlListener
              // https://searchfox.org/comm-central/rev/d9f4b21312781d3abb9c88cade1d077b9e1622f4/mailnews/local/src/nsLocalMailFolder.cpp#615
              folder.emptyTrash(null);
              return;
            }

            let urlListener = new UrlListener();
            folder.emptyTrash(urlListener);
            await urlListener.isDone();
          }

          try {
            console.info("XPUNGE: Emptying trash for account:", rootFolder.server.prettyName);
            const accountTrashFolder = rootFolder.getFolderWithFlags(Ci.nsMsgFolderFlags.Trash);
            if (accountTrashFolder) {
              // Check if this is a top-level smart folder. If so, we're going
              // to empty all the trash folders.
              if (FolderUtils.isSmartVirtualFolder(rootFolder)) {
                for (const server of MailServices.accounts.allServers) {
                  for (const trashFolder of server.rootFolder.getFoldersWithFlags(
                    Ci.nsMsgFolderFlags.Trash
                  )) {
                    await _emptyTrash(trashFolder);
                  }
                }
              } else {
                await _emptyTrash(accountTrashFolder);
              }
            }
            console.info("XPUNGE: Done");
          } catch (ex) {
            console.info("XPUNGE: Failed emptying trash for account:", rootFolder.server.prettyName, ex);
          }
        },
        // Compact specified folder, or the entire account, if the folder is a
        // root folder.
        async compact(folder, options) {
          let nativeFolder = context.extension.folderManager.get(
            folder.accountId,
            folder.path
          );
          
          // Workaround for Bugzilla Bug 1977840 - Refresh folder before compacting
          // This helps ensure the folder is properly initialized before compacting
          try {
            if (nativeFolder.server.type === "imap" && !nativeFolder.isServer) {
              // For IMAP folders, refresh the folder to ensure it's properly initialized
              await new Promise((resolve, reject) => {
                let refreshListener = {
                  OnStartRunningUrl() {},
                  OnStopRunningUrl(url, exitCode) {
                    if (Components.isSuccessCode(exitCode)) {
                      resolve();
                    } else {
                      // Even if refresh fails, we continue with compacting
                      resolve(); // Don't fail the entire operation
                    }
                  }
                };
                try {
                  nativeFolder.refresh(refreshListener);
                } catch (e) {
                  // If refresh method is not available or fails, continue anyway
                  resolve();
                }
              });
            }
          } catch (e) {
            // Ignore refresh errors, continue with compacting
            console.debug("XPUNGE: Folder refresh failed, continuing with compact operation:", e);
          }
          
          if (nativeFolder.isServer) {
            // Compact the entire account.
            try {
              console.info("XPUNGE: Compacting all folders for account:", nativeFolder.server.prettyName);
              let urlListener = new UrlListener();
              nativeFolder.compactAll(urlListener, null);
              await urlListener.isDone();
              console.info("XPUNGE: Done");
            } catch (ex) {
              // Handle the specific error code 2153054245 from Bugzilla Bug 1977840
              if (ex === 2153054245) {
                console.info("XPUNGE: Failed compacting all folders for account:", nativeFolder.server.prettyName, 
                  "Error: Folder not refreshed. Please select the junk folder in Thunderbird first.");
              } else {
                console.info("XPUNGE: Failed compacting all folders for account:", nativeFolder.server.prettyName, ex);
              }
            }
          } else {
            // Compact the specified folder
            // Can't compact folders that have just been compacted.
            if (nativeFolder.server.type != "imap" && !nativeFolder.expungedBytes) {
              console.info("XPUNGE: Nothing to do, skipping compacting of folder (", nativeFolder.prettyName, ") on account:", nativeFolder.server.prettyName);
              return;
            }
            
            try {
              console.info("XPUNGE: Compacting folder (", nativeFolder.prettyName, ") on account:", nativeFolder.server.prettyName);
              let urlListener = new UrlListener();
              nativeFolder.compact(urlListener, null);
              await urlListener.isDone();
              console.info("XPUNGE: Done");
            } catch (ex) {
              // Handle the specific error code 2153054245 from Bugzilla Bug 1977840
              if (ex === 2153054245) {
                console.info("XPUNGE: Failed compacting folder (", nativeFolder.prettyName, ") on account:", nativeFolder.server.prettyName,
                  "Error: Folder not refreshed. Please select the folder in Thunderbird first.");
              } else {
                console.info("XPUNGE: Failed compacting folder (", nativeFolder.prettyName, ") on account:", nativeFolder.server.prettyName, ex);
              }
            }
          }
        },
      },
    };
  }
};