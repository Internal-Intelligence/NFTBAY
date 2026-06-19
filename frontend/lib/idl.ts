// Placeholder IDL - run `anchor build` then replace this with the generated IDL
// from target/idl/nftbay.json and also copy types from target/types

export const IDL = {
  address: "NFTBay1111111111111111111111111111111111111",
  metadata: {
    name: "nftbay",
    version: "0.1.0",
    spec: "0.1.0",
  },
  instructions: [
    {
      name: "initializeMarketplace",
      accounts: [],
      args: [{ name: "feeBps", type: "u16" }],
    },
    {
      name: "listNft",
      accounts: [],
      args: [{ name: "price", type: "u64" }],
    },
    {
      name: "buyNft",
      accounts: [],
      args: [],
    },
    {
      name: "cancelListing",
      accounts: [],
      args: [],
    },
  ],
  accounts: [],
  events: [],
  errors: [],
} as const;
