// @ts-check
import { defineConfig } from 'astro/config';

// During initial preview, we deploy to https://yannantang.github.io/bbsw-app/
// When app.bbsw.org DNS is configured, switch to:
//   site: 'https://app.bbsw.org', base: '/'
export default defineConfig({
  site: 'https://yannantang.github.io',
  base: '/bbsw-app',
  trailingSlash: 'ignore',
});
