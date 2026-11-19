import {fileURLToPath} from 'node:url';
import vue from '@vitejs/plugin-vue';
import {defineConfig} from 'vite';
import {validationApi} from './server/api.ts';

const repoDir = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
  plugins: [vue(), validationApi({repoDir})],
});
