import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const PUBLIC_PORTRAITS_DIR = path.join(process.cwd(), 'public', 'portraits');
const ARTSTATION_DIR = path.join(PUBLIC_PORTRAITS_DIR, 'artstation');
const WIKI_DIR = path.join(PUBLIC_PORTRAITS_DIR, 'wiki');

fs.mkdirSync(ARTSTATION_DIR, { recursive: true });
fs.mkdirSync(WIKI_DIR, { recursive: true });

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Referer: 'https://jujutsu-kaisen.fandom.com/',
};

// 1. Copy the 5 uploaded ArtStation portraits (KwnBlack artwork/9mndGv)
const artstationUploads = [
  {
    src: 'C:/Users/Thiago/.gemini/antigravity/brain/852e3d6b-2111-49f2-b97a-256f62fa1927/.user_uploaded/media_1792442780449_3818a526.png',
    dest: 'nanami.png',
    character: 'Kento Nanami',
  },
  {
    src: 'C:/Users/Thiago/.gemini/antigravity/brain/852e3d6b-2111-49f2-b97a-256f62fa1927/.user_uploaded/media_1792442784613_0e1a5a0e.png',
    dest: 'sukuna.png',
    character: 'Ryomen Sukuna',
  },
  {
    src: 'C:/Users/Thiago/.gemini/antigravity/brain/852e3d6b-2111-49f2-b97a-256f62fa1927/.user_uploaded/media_1792442788043_4d2e5238.png',
    dest: 'gojo.png',
    character: 'Satoru Gojo',
  },
  {
    src: 'C:/Users/Thiago/.gemini/antigravity/brain/852e3d6b-2111-49f2-b97a-256f62fa1927/.user_uploaded/media_1792442791257_57792526.png',
    dest: 'choso.png',
    character: 'Choso',
  },
  {
    src: 'C:/Users/Thiago/.gemini/antigravity/brain/852e3d6b-2111-49f2-b97a-256f62fa1927/.user_uploaded/media_1792442794390_d8237b33.png',
    dest: 'geto.png',
    character: 'Suguru Geto',
  },
];

for (const item of artstationUploads) {
  if (fs.existsSync(item.src)) {
    fs.copyFileSync(item.src, path.join(ARTSTATION_DIR, item.dest));
  }
}

function isValidImageFile(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const stat = fs.statSync(filePath);
  if (stat.size < 400) return false;
  const fd = fs.openSync(filePath, 'r');
  const buf = Buffer.alloc(16);
  fs.readSync(fd, buf, 0, 16, 0);
  fs.closeSync(fd);
  const str = buf.toString('utf8');
  if (str.includes('<!DOCTYPE') || str.includes('<html') || str.includes('<div')) {
    return false;
  }
  return true;
}

async function downloadWithCurl(url, destPath) {
  await execFileAsync('curl.exe', [
    '-s',
    '-L',
    '-A',
    HEADERS['User-Agent'],
    '-H',
    `Referer: ${HEADERS.Referer}`,
    url,
    '-o',
    destPath,
  ]);
  return isValidImageFile(destPath);
}

async function fetchWikiPortraits() {
  let gcmcontinue = '';
  const allFiles = [];

  while (true) {
    const apiUrl = new URL('https://jujutsu-kaisen.fandom.com/api.php');
    apiUrl.searchParams.set('action', 'query');
    apiUrl.searchParams.set('generator', 'categorymembers');
    apiUrl.searchParams.set('gcmtitle', 'Category:Portrait_Images');
    apiUrl.searchParams.set('gcmlimit', '50');
    apiUrl.searchParams.set('prop', 'imageinfo');
    apiUrl.searchParams.set('iiprop', 'url');
    apiUrl.searchParams.set('format', 'json');
    if (gcmcontinue) {
      apiUrl.searchParams.set('gcmcontinue', gcmcontinue);
    }

    const res = await fetch(apiUrl.toString(), { headers: HEADERS });
    const data = await res.json();
    const pages = data?.query?.pages || {};
    for (const page of Object.values(pages)) {
      const title = page.title || '';
      const rawUrl = page.imageinfo?.[0]?.url || '';
      if (title && rawUrl) {
        const cleanFileName = title.replace(/^File:/i, '').trim();
        const safeLocalName = cleanFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const thumbUrl = rawUrl.replace(
          /\/revision\/latest.*$/i,
          '/revision/latest/scale-to-width-down/220'
        );
        allFiles.push({
          title,
          fileName: cleanFileName,
          safeLocalName,
          rawUrl,
          thumbUrl,
        });
      }
    }

    if (data?.continue?.gcmcontinue) {
      gcmcontinue = data.continue.gcmcontinue;
    } else {
      break;
    }
  }

  console.log(`[JJK Wiki] Baixando ${allFiles.length} portraits de Category:Portrait_Images...`);

  const CONCURRENCY = 20;
  let downloaded = 0;
  let index = 0;

  async function worker() {
    while (index < allFiles.length) {
      const currentIdx = index++;
      const item = allFiles[currentIdx];
      const destPath = path.join(WIKI_DIR, item.safeLocalName);

      if (isValidImageFile(destPath)) {
        downloaded++;
        continue;
      }

      try {
        let ok = await downloadWithCurl(item.thumbUrl, destPath);
        if (!ok) {
          ok = await downloadWithCurl(item.rawUrl, destPath);
        }
        if (ok) {
          downloaded++;
        } else if (fs.existsSync(destPath)) {
          fs.unlinkSync(destPath);
        }
      } catch {
        if (fs.existsSync(destPath)) {
          try {
            fs.unlinkSync(destPath);
          } catch {}
        }
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  console.log(`[JJK Wiki] Concluído: ${downloaded}/${allFiles.length} portraits válidos salvos em public/portraits/wiki/!`);

  fs.writeFileSync(
    path.join(PUBLIC_PORTRAITS_DIR, 'manifest.json'),
    JSON.stringify(
      {
        artstation: artstationUploads.map((a) => ({
          character: a.character,
          localUrl: `/portraits/artstation/${a.dest}`,
        })),
        wiki: allFiles.map((f) => ({
          fileName: f.fileName,
          safeLocalName: f.safeLocalName,
          localUrl: `/portraits/wiki/${f.safeLocalName}`,
          remoteUrl: f.rawUrl,
        })),
      },
      null,
      2
    ),
    'utf-8'
  );
}

fetchWikiPortraits();
