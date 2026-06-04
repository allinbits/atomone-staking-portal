import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { defineConfig, Plugin } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import vueDevTools from "vite-plugin-vue-devtools";

/*
 * Emits a Netlify "_headers" file with a Content-Security-Policy whose
 * connect-src is scoped to the chain this build targets. netlify.toml headers
 * cannot vary per deploy context, so the CSP lives here instead: production
 * (mainnet) only ever permits the mainnet endpoints, and testnet previews only
 * the testnet endpoints. VITE_CHAIN_ENV is set per context in netlify.toml.
 */
const netlifyCspHeaders = (): Plugin => {
  const mainnet = "https://atomone-rpc.allinbits.com https://atomone-api.allinbits.com";
  const testnet = "https://atomone-testnet-1-rpc.allinbits.services https://atomone-testnet-1-api.allinbits.services";
  return {
    name: "netlify-csp-headers",
    apply: "build",
    generateBundle () {
      const connectSrc = process.env.VITE_CHAIN_ENV === "testnet"
        ? testnet
        : mainnet;
      const csp = [
        "default-src 'self' 'wasm-unsafe-eval'",
        "style-src 'self' 'unsafe-inline'",
        "script-src 'self' 'wasm-unsafe-eval'",
        "object-src 'none'",
        "img-src 'self' data: https:",
        `connect-src ${connectSrc}`
      ].join("; ");
      this.emitFile({
        type: "asset",
        fileName: "_headers",
        source: `/*\n  Content-Security-Policy: ${csp}\n`
      });
    }
  };
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    nodePolyfills({
      // Whether to polyfill specific globals.
      globals: {
        Buffer: true, // can also be 'build', 'dev', or false
        global: true,
        process: true
      }
    }),
    tailwindcss(),
    vue(),
    vueDevTools(),
    netlifyCspHeaders()
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(
        "./src",
        import.meta.url
      )),
      "~": fileURLToPath(new URL(
        "./src",
        import.meta.url
      ))
    }
  },
  define: { __INTLIFY_JIT_COMPILATION__: true }
});
