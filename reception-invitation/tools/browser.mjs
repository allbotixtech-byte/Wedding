// Locate an installed Chromium-based browser (Chrome or Edge) for painting backgrounds and rendering video.
import fs from 'node:fs';
import path from 'node:path';

export function findBrowser() {
  const env = process.env;
  const candidates = [
    env.BROWSER_PATH,
    path.join(env['PROGRAMFILES'] || 'C:/Program Files', 'Google/Chrome/Application/chrome.exe'),
    path.join(env['PROGRAMFILES(X86)'] || 'C:/Program Files (x86)', 'Google/Chrome/Application/chrome.exe'),
    path.join(env['LOCALAPPDATA'] || '', 'Google/Chrome/Application/chrome.exe'),
    path.join(env['PROGRAMFILES(X86)'] || 'C:/Program Files (x86)', 'Microsoft/Edge/Application/msedge.exe'),
    path.join(env['PROGRAMFILES'] || 'C:/Program Files', 'Microsoft/Edge/Application/msedge.exe'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium',
  ].filter(Boolean);
  for (const c of candidates) if (fs.existsSync(c)) return c;
  throw new Error('Could not find Google Chrome or Microsoft Edge. Install one of them, or set the BROWSER_PATH environment variable to the browser .exe.');
}
