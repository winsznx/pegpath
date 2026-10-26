// Fragments copied verbatim from the verified implementation ABIs on the Mezo testnet Blockscout
// explorer (api.explorer.test.mezo.org/api/v2/smart-contracts/<implementation>), fetched 2026-10-21.
// Compiler: solc 0.8.24. Implementation addresses live in addresses.ts and are re-checked at runtime.

// TroveManager implementation 0x9aab567966983e95536fc460c12266fb0cc10b07
export const troveManagerAbi = [
  {
    "type": "event",
    "name": "Redemption",
    "inputs": [
      {
        "name": "_attemptedAmount",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "_actualAmount",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "_collateralSent",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "_collateralFee",
        "type": "uint256",
        "indexed": false
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "TroveUpdated",
    "inputs": [
      {
        "name": "_borrower",
        "type": "address",
        "indexed": true
      },
      {
        "name": "_principal",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "_interest",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "_coll",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "_stake",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "_interestRate",
        "type": "uint16",
        "indexed": false
      },
      {
        "name": "_lastInterestUpdateTime",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "_operation",
        "type": "uint8",
        "indexed": false
      }
    ],
    "anonymous": false
  },
  {
    "type": "function",
    "name": "MCR",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MUSD_GAS_COMPENSATION",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "borrowerOperations",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getCurrentICR",
    "inputs": [
      {
        "name": "_borrower",
        "type": "address"
      },
      {
        "name": "_price",
        "type": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getEntireDebtAndColl",
    "inputs": [
      {
        "name": "_borrower",
        "type": "address"
      }
    ],
    "outputs": [
      {
        "name": "coll",
        "type": "uint256"
      },
      {
        "name": "principal",
        "type": "uint256"
      },
      {
        "name": "interest",
        "type": "uint256"
      },
      {
        "name": "pendingCollateral",
        "type": "uint256"
      },
      {
        "name": "pendingPrincipal",
        "type": "uint256"
      },
      {
        "name": "pendingInterest",
        "type": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getTCR",
    "inputs": [
      {
        "name": "_price",
        "type": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "interestRateManager",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "musdToken",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "priceFeed",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "redeemCollateral",
    "inputs": [
      {
        "name": "_amount",
        "type": "uint256"
      },
      {
        "name": "_firstRedemptionHint",
        "type": "address"
      },
      {
        "name": "_upperPartialRedemptionHint",
        "type": "address"
      },
      {
        "name": "_lowerPartialRedemptionHint",
        "type": "address"
      },
      {
        "name": "_partialRedemptionHintNICR",
        "type": "uint256"
      },
      {
        "name": "_maxIterations",
        "type": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "sortedTroves",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view"
  }
] as const;

// HintHelpers implementation 0x8adf3f35dbe4026112bcfc078872bcb967732ea8
export const hintHelpersAbi = [
  {
    "type": "function",
    "name": "getApproxHint",
    "inputs": [
      {
        "name": "_CR",
        "type": "uint256"
      },
      {
        "name": "_numTrials",
        "type": "uint256"
      },
      {
        "name": "_inputRandomSeed",
        "type": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "hintAddress",
        "type": "address"
      },
      {
        "name": "diff",
        "type": "uint256"
      },
      {
        "name": "latestRandomSeed",
        "type": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getRedemptionHints",
    "inputs": [
      {
        "name": "_amount",
        "type": "uint256"
      },
      {
        "name": "_price",
        "type": "uint256"
      },
      {
        "name": "_maxIterations",
        "type": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "firstRedemptionHint",
        "type": "address"
      },
      {
        "name": "partialRedemptionHintNICR",
        "type": "uint256"
      },
      {
        "name": "truncatedAmount",
        "type": "uint256"
      }
    ],
    "stateMutability": "view"
  }
] as const;

// SortedTroves implementation 0x9177df58a9614b84c8c2f68df27506ab9a5d0323
export const sortedTrovesAbi = [
  {
    "type": "function",
    "name": "findInsertPosition",
    "inputs": [
      {
        "name": "_NICR",
        "type": "uint256"
      },
      {
        "name": "_prevId",
        "type": "address"
      },
      {
        "name": "_nextId",
        "type": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "address"
      },
      {
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getLast",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getPrev",
    "inputs": [
      {
        "name": "_id",
        "type": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getSize",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view"
  }
] as const;

// PriceFeed implementation 0xec42b37c12b8d73d320f4075a1bcd58b306629c1
export const priceFeedAbi = [
  {
    "type": "function",
    "name": "fetchPrice",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view"
  }
] as const;

// MUSD implementation 0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503 (not a proxy)
export const musdAbi = [
  {
    "type": "event",
    "name": "Transfer",
    "inputs": [
      {
        "name": "from",
        "type": "address",
        "indexed": true
      },
      {
        "name": "to",
        "type": "address",
        "indexed": true
      },
      {
        "name": "value",
        "type": "uint256",
        "indexed": false
      }
    ],
    "anonymous": false
  },
  {
    "type": "function",
    "name": "balanceOf",
    "inputs": [
      {
        "name": "account",
        "type": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "decimals",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint8"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "symbol",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view"
  }
] as const;

// BorrowerOperations implementation 0xc05bf344bd5b58825784326dd3112fb6cc160dcc
export const borrowerOperationsAbi = [
  {
    "type": "function",
    "name": "getRedemptionRate",
    "inputs": [
      {
        "name": "_collateralDrawn",
        "type": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "minNetDebt",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "redemptionRate",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view"
  }
] as const;

// InterestRateManager implementation 0xaa13b1d9cffa3f44ab3a8be0dc8774fb7841459c
export const interestRateManagerAbi = [
  {
    "type": "function",
    "name": "interestRate",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint16"
      }
    ],
    "stateMutability": "view"
  }
] as const;
