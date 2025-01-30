/// <reference types="vite/client" />
import type { Window as KeplrWindow, Keplr, KeplrSignOptions, AminoSignResponse, OfflineAminoSigner } from "@keplr-wallet/types";

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/ban-types
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

interface Nephos {
  loaded: boolean;
  ready: () => Promise<boolean>;
  getAddress: (chain: string) => Promise<string>;
  getPublicKey: (chain: string) => Promise<Uint8Array>;
  getOfflineSigner: (id: string) => Promise<OfflineAminoSigner>;
  isLedger: () => Promise<boolean>;
  getChains: () => Promise<string[]>;
  getAccountName: () => Promise<string>;
  enable: (chains: string[], origin?: string) => Promise<boolean>;
  signTransaction: (tx: Transactions.AbstractTransaction, origin?: string) => Promise<Transactions.SignedTransaction>;
  signAndBroadcastTransaction: (tx: Transactions.AbstractTransaction) => Promise<Transactions.TransactionResult>;
  signDirect: (signerAddress: string, signDoc: SignDoc, signOptions?: KeplrSignOptions) => Promise<DirectSignResponse>;
  signAmino: (signerAddress: string, signDoc: StdSignDoc, signOptions?: KeplrSignOptions) => Promise<AminoSignResponse>;
}

declare global {
  interface Window extends KeplrWindow {
    leap: Keplr;
    cosmostation: unknown;
    nephos: Nephos
  }
}
