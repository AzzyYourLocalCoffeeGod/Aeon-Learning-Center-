const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('aeonFiles', {
  openDocuments: () => ipcRenderer.invoke('aeon:open-documents'),
  openRecent: filePath => ipcRenderer.invoke('aeon:open-recent', filePath),
  saveDocument: options => ipcRenderer.invoke('aeon:save-document', options),
  exportOffice: options => ipcRenderer.invoke('aeon:export-office', options),
  openImage: () => ipcRenderer.invoke('aeon:open-image'),
  readClipboardText: () => ipcRenderer.invoke('aeon:clipboard-read'),
  writeClipboardText: text => ipcRenderer.invoke('aeon:clipboard-write', text),
  openDictionarySource: url => ipcRenderer.invoke('aeon:open-dictionary-source', url)
});
