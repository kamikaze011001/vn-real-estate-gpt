import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const profile = JSON.parse(readFileSync('data/plugin-profile.json', 'utf8'));
assert.ok(profile.subtitle.length <= 30);
assert.ok(profile.starterPrompts.every(text => text.length <= 128));
const folder = resolve('artifacts/nha-ha-noi-plugin');
// Only this generated package folder is replaced, never the source or operator data.
rmSync(folder, { recursive: true, force: true });
mkdirSync(resolve(folder, 'assets'), { recursive: true });
mkdirSync(resolve(folder, 'skills/setup'), { recursive: true });
const manifest = {
  $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
  name: 'nha-ha-noi', version: '0.1.0', description: profile.description,
  author: { name: 'anh sơn' }, homepage: profile.website,
  repository: 'https://github.com/kamikaze011001/vn-real-estate-gpt',
  extensions: { 'com.openai': {
    apps: './.app.json', onboardingSkill: './skills/setup/SKILL.md',
    interface: {
      displayName: profile.name, shortDescription: profile.subtitle, longDescription: profile.longDescription,
      developerName: 'anh sơn', category: 'Productivity', websiteURL: profile.website,
      brandColor: '#A54F39', brandColorDark: '#D89377',
      composerIcon: './assets/icon.png', logo: './assets/icon.png', defaultPrompt: profile.starterPrompts,
    },
  } },
};
writeFileSync(resolve(folder, 'plugin.json'), JSON.stringify(manifest, null, 2)+'\n');
writeFileSync(resolve(folder, '.app.json'), JSON.stringify({ apps: { 'nha-ha-noi': {
  id: profile.mcpConnectionPluginId, required: true,
} } }, null, 2)+'\n');
copyFileSync(profile.icon, resolve(folder, 'assets/icon.png'));
copyFileSync('plugin/skills/setup/SKILL.md', resolve(folder, 'skills/setup/SKILL.md'));
const archive = resolve('artifacts/nha-ha-noi-plugin.zip');
rmSync(archive, { force: true });
execFileSync('zip', ['-qr', archive, '.'], { cwd: folder });
console.log(`Prepared private plugin package: ${archive}`);
console.log('Reuses the existing MCP connection. No credentials, raw source files or local execution hooks included.');
