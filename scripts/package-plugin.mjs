import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const profile = JSON.parse(readFileSync('data/plugin-profile.json', 'utf8'));
assert.ok(profile.subtitle.length <= 30);
assert.match(profile.mcpConnectionAppId, /^(asdk_app_|connector_|templated_apps_)[A-Za-z0-9][A-Za-z0-9_-]*$/);
assert.ok(profile.starterPrompts.every(text => text.length <= 128));
const portable = process.argv.includes('--portable');
const packageName = portable ? 'nha-ha-noi-pilot-plugin' : 'nha-ha-noi-plugin';
const folder = resolve('artifacts', packageName);
// Only this generated package folder is replaced, never the source or operator data.
rmSync(folder, { recursive: true, force: true });
mkdirSync(resolve(folder, 'assets'), { recursive: true });
mkdirSync(resolve(folder, 'skills/setup'), { recursive: true });
const manifest = {
  $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
  name: 'nha-ha-noi', version: profile.version, description: profile.description,
  author: { name: 'anh sơn' }, homepage: profile.website,
  repository: 'https://github.com/kamikaze011001/vn-real-estate-gpt',
  extensions: { 'com.openai': {
    ...(portable ? {} : { apps: './.app.json' }), onboardingSkill: './skills/setup/SKILL.md',
    interface: {
      displayName: profile.name, shortDescription: profile.subtitle, longDescription: profile.longDescription,
      developerName: 'anh sơn', category: 'Productivity', websiteURL: profile.website,
      brandColor: '#A54F39', brandColorDark: '#D89377',
      composerIcon: './assets/icon.png', logo: './assets/icon.png', defaultPrompt: profile.starterPrompts,
    },
  } },
};
writeFileSync(resolve(folder, 'plugin.json'), JSON.stringify(manifest, null, 2)+'\n');
if (portable) writeFileSync(resolve(folder, 'mcp.json'), JSON.stringify({
  $schema: 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json',
  mcpServers: { 'nha-ha-noi': { type: 'streamable-http', url: profile.mcpServerUrl } },
}, null, 2)+'\n');
else writeFileSync(resolve(folder, '.app.json'), JSON.stringify({ apps: { 'nha-ha-noi': {
  id: profile.mcpConnectionAppId, required: true,
} } }, null, 2)+'\n');
copyFileSync(profile.icon, resolve(folder, 'assets/icon.png'));
copyFileSync('plugin/skills/setup/SKILL.md', resolve(folder, 'skills/setup/SKILL.md'));
const archive = resolve('artifacts', packageName+'.zip');
rmSync(archive, { force: true });
execFileSync('zip', ['-qr', archive, '.'], { cwd: folder });
console.log(`Prepared ${portable ? 'portable pilot' : 'private update'} plugin package: ${archive}`);
console.log(portable ? 'Uses the stable MCP URL; each tester authorizes their own connection subject to account policy. Not a public-directory listing.' : 'Reuses the existing private MCP connection.');
console.log('No credentials, raw source files or local execution hooks included.');
