// Проверка «начинки» программы для Windows прямо на Mac:  cd windows/служебное && node test-on-mac.mjs
// Windows-программу на Mac не запустить, но её логика (окно, меню, открытие файла из командной строки, сохранение в файл,
// шрифты и библиотеки без интернета, мостик) — та же самая JavaScript-часть (app.asar). Берём собранную программу для Mac
// (mac/Контур.app), подменяем в её копии app.asar на windows/служебное/dist/win-unpacked/resources/app.asar
// и прогоняем обычную проверку mac/служебное/test-app.mjs. Установщик, ярлыки и привязку .kontur в Проводнике так не проверить —
// это только на настоящей Windows (см. CLAUDE.md, раздел 9).
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync, cpSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const MAC_APP = join(HERE, '..', '..', 'mac', 'Контур.app'), ASAR = join(HERE, 'dist', 'win-unpacked', 'resources', 'app.asar');
if (!existsSync(MAC_APP)) throw Error('нет ' + MAC_APP + ' — сначала: cd ../../mac/служебное && node build.mjs --arch arm64 --dir');
if (!existsSync(ASAR)) throw Error('нет ' + ASAR + ' — сначала: node build.mjs --dir');
const TMP = mkdtempSync(join(tmpdir(), 'kt-win-on-mac-')), APP = join(TMP, 'Контур.app');
cpSync(MAC_APP, APP, { recursive: true, verbatimSymlinks: true });
cpSync(ASAR, join(APP, 'Contents', 'Resources', 'app.asar'));
execFileSync('codesign', ['--force', '--deep', '--sign', '-', APP], { stdio: 'ignore' });   // после подмены — заново подписать (ad-hoc)
console.log('Программа для Mac с «начинкой» Windows-версии:', APP, '\n');
try { execFileSync('node', [join(HERE, '..', '..', 'mac', 'служебное', 'test-app.mjs'), APP], { stdio: 'inherit' }); } finally { rmSync(TMP, { recursive: true, force: true }); }
