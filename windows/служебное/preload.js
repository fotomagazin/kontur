// Мостик между программой (страница) и Mac: страница видит только эти несколько функций (window.fmNative),
// доступа к диску и системе у неё по-прежнему нет.
'use strict';
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('fmNative', {
  platform: process.platform === 'win32' ? 'win' : 'mac',
  arch: process.arch,   // 'arm64' — процессоры Apple, 'x64' — Intel: какой установщик скачивать при обновлении
  // сохранить проект: path — куда (null — спросить), name — имя по умолчанию; вернёт путь или null (отменили)
  saveFile: opts => ipcRenderer.invoke('save-file', opts),
  // путь к файлу на диске (для «Открыть» и перетаскивания из Finder)
  pathOf: file => { try { return webUtils.getPathForFile(file) || ''; } catch (e) { return ''; } },
  // файл открыт — в «Открыть недавние» и в заголовок окна
  opened: p => ipcRenderer.send('opened', p),
  setDocPath: p => ipcRenderer.send('doc-path', p),
  // файлы из Finder / Dock / «Открыть недавние»
  onOpenFiles: cb => ipcRenderer.on('open-files', (e, files) => cb(files)),
  // шрифты, лежащие внутри программы (Контур читает их байтами, чтобы превращать буквы в кривые без интернета)
  vendor: rel => ipcRenderer.invoke('vendor', rel),
});
