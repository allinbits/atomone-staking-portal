import mainnet from "./chain-config.json";
import testnet from "./chain-config.testnet.json";

/*
 * Selects which chain the dapp targets at build time. VITE_CHAIN_ENV is set per
 * Netlify deploy context in netlify.toml: "testnet" for deploy previews and
 * branch deploys, "mainnet" for production. Anything other than "testnet" —
 * including local development where the variable is unset — falls back to
 * mainnet. The selected object is the full chain config handed to wallets
 * (Keplr/Leap/Cosmostation suggestChain), so each environment must be complete.
 */
const chainConfig: typeof mainnet =
  import.meta.env.VITE_CHAIN_ENV === "testnet"
    ? testnet
    : mainnet;

export default chainConfig;
