const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const root = path.resolve(__dirname, '..');
const siteDir = path.join(root, 'downloaded_site');
const outZip = path.join(root, 'blissdermacare-amplify.zip');

function isHtmlFile(name) {
  return name.toLowerCase().endsWith('.html');
}

if (!fs.existsSync(siteDir)) {
  console.error('downloaded_site directory not found at', siteDir);
  process.exit(1);
}

const entries = fs.readdirSync(siteDir);

entries.forEach((entry) => {
  const full = path.join(siteDir, entry);
  const stat = fs.statSync(full);
  if (stat.isFile() && isHtmlFile(entry)) {
    const base = path.basename(entry, '.html');
    if (base === 'index') return; // leave root index.html alone

    const targetDir = path.join(siteDir, base);
    const targetIndex = path.join(targetDir, 'index.html');

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
      console.log('Created directory', targetDir);
    }

    // Move (or overwrite) the file into target/index.html
    try {
      // If target index exists, remove it first so rename won't fail on some platforms
      if (fs.existsSync(targetIndex)) fs.unlinkSync(targetIndex);
      fs.renameSync(full, targetIndex);
      console.log(`Moved ${entry} -> ${path.relative(root, targetIndex)}`);
    } catch (err) {
      console.error('Failed to move', full, '->', targetIndex, err);
    }
  }
});

// Create ZIP
try {
  if (fs.existsSync(outZip)) {
    fs.unlinkSync(outZip);
  }
  const zip = new AdmZip();
  // Add the contents of downloaded_site at the root of the zip
  zip.addLocalFolder(siteDir, '');
  zip.writeZip(outZip);
  console.log('Created ZIP at', outZip);
} catch (err) {
  console.error('Failed to create ZIP', err);
  process.exit(1);
}

console.log('Done. Please redeploy blissdermacare-amplify.zip to Amplify or commit/push the changes.');
