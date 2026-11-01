import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const profile = JSON.parse(readFileSync('data/plugin-profile.json', 'utf8'));
for (const portable of [false, true]) {
  test(`${portable ? 'portable pilot' : 'private update'} archive contains only installable metadata, icon and onboarding`, () => {
    execFileSync(process.execPath, ['scripts/package-plugin.mjs', ...(portable ? ['--portable'] : [])]);
    const archive = `artifacts/${portable ? 'nha-ha-noi-pilot-plugin' : 'nha-ha-noi-plugin'}.zip`;
    const entries = execFileSync('unzip', ['-Z1', archive], { encoding: 'utf8' }).trim().split('\n').filter(x => !x.endsWith('/')).sort();
    assert.deepEqual(entries, [portable ? 'mcp.json' : '.app.json', 'plugin.json', 'assets/icon.png', 'skills/setup/SKILL.md'].sort());
    const get = name => execFileSync('unzip', ['-p', archive, name]);
    const manifest = JSON.parse(get('plugin.json'));
    assert.equal(manifest.version, profile.version);
    assert.ok(manifest.extensions['com.openai'].interface.defaultPrompt.length <= 3);
    const png = get('assets/icon.png');
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16), 512); assert.equal(png.readUInt32BE(20), 512);
    assert.deepEqual(png, readFileSync(profile.icon));
    if (portable) {
      const mcp = JSON.parse(get('mcp.json'));
      assert.equal(mcp.mcpServers['nha-ha-noi'].type, 'streamable-http');
      assert.equal(mcp.mcpServers['nha-ha-noi'].url, profile.mcpServerUrl);
      assert.deepEqual(Object.keys(mcp.mcpServers['nha-ha-noi']).sort(), ['type','url'], 'portable transport must satisfy the canonical schema without vendor-only authentication fields');
      assert.equal(manifest.extensions['com.openai'].apps, undefined);
      assert.ok(!JSON.stringify([manifest,mcp]).includes(profile.mcpConnectionAppId), 'pilot must not depend on the operator account');
      const endpoint = new URL(mcp.mcpServers['nha-ha-noi'].url);
      assert.equal(endpoint.protocol, 'https:'); assert.equal(endpoint.username, ''); assert.equal(endpoint.password, ''); assert.equal(endpoint.search, '');
    } else {
      assert.equal(JSON.parse(get('.app.json')).apps['nha-ha-noi'].id, profile.mcpConnectionAppId);
    }
  });
}
