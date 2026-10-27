// @ts-check
import { createConfigForNuxt } from '@nuxt/eslint-config/flat'

export default createConfigForNuxt({
  features: {
    tooling: true,
    stylistic: true,
  },
  dirs: {
    // Nuxt apps inside the repo: their pages and layouts follow Nuxt's rules.
    src: [
      './playground',
      './test/fixtures/basic',
    ],
  },
})
