import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
export default defineConfig({ root: 'research-web', plugins: [viteSingleFile()], build: { outDir: '../dist-research', emptyOutDir: true } });
