/**
 * Mezo Passport, imported per module. The package root also exports Passport's account UI, which is
 * built on @mezo-org/mezo-clay; that bundles React 18's JSX runtime and crashes under React 19.
 * PegPath only needs the wagmi config, the Bitcoin wallet connectors and the account hook.
 */
export { getConfig } from "@mezo-org/passport/dist/src/config";
export {
  okxWalletMezoTestnet,
  unisatWalletMezoTestnet,
  xverseWalletMezoTestnet,
} from "@mezo-org/passport/dist/src/config";
export { useWalletAccount } from "@mezo-org/passport/dist/src/hooks/useWalletAccount";
