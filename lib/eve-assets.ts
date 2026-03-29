/**
 * Server-side helpers for querying EVE Frontier blockchain assets.
 * Uses the Sui testnet GraphQL endpoint directly (no browser APIs).
 */

const GRAPHQL_ENDPOINT = "https://graphql.testnet.sui.io/graphql";
const EVE_WORLD_PACKAGE = "0xf115375112eab1dcc1bb4af81a37d47ca7e95c2eb990cefa1f12f82d689e9543";
const CHARACTER_PLAYER_PROFILE_TYPE = `${EVE_WORLD_PACKAGE}::character::PlayerProfile`;

async function graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`GraphQL HTTP error: ${res.status}`);
  const data = await res.json();
  if (data.errors?.length) throw new Error(data.errors[0].message);
  return data.data as T;
}

export interface EveCharacter {
  /** On-chain character object address */
  id: string;
  name: string;
  corpId?: number;
}

/**
 * Returns the EVE character linked to a wallet address, or null if none found.
 */
export async function getCharacterByWallet(walletAddress: string): Promise<EveCharacter | null> {
  const query = `
    query GetWalletCharacter($owner: SuiAddress!, $type: String!) {
      address(address: $owner) {
        objects(last: 1, filter: { type: $type }) {
          nodes {
            contents {
              extract(path: "character_id") {
                asAddress {
                  asObject {
                    address
                    asMoveObject {
                      contents {
                        json
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await graphql<any>(query, {
      owner: walletAddress,
      type: CHARACTER_PLAYER_PROFILE_TYPE,
    });

    const node = data?.address?.objects?.nodes?.[0];
    const charObj = node?.contents?.extract?.asAddress?.asObject;
    if (!charObj) return null;

    const json = charObj.asMoveObject?.contents?.json;
    return {
      id: charObj.address,
      name: json?.name ?? "",
      corpId: json?.corp_id ?? undefined,
    };
  } catch {
    return null;
  }
}

export interface EveSsu {
  /** On-chain SSU object address */
  id: string;
  name: string;
  status: string;
}

/**
 * Returns Smart Storage Units owned by the given character address.
 */
export async function getSsusByCharacter(characterId: string): Promise<EveSsu[]> {
  const SSU_TYPE = `${EVE_WORLD_PACKAGE}::smart_storage_unit::SmartStorageUnit`;

  const query = `
    query GetCharacterSsus($owner: SuiAddress!, $type: String!) {
      address(address: $owner) {
        objects(filter: { type: $type }) {
          nodes {
            address
            asMoveObject {
              contents {
                json
              }
            }
          }
        }
      }
    }
  `;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await graphql<any>(query, {
      owner: characterId,
      type: SSU_TYPE,
    });

    const nodes = data?.address?.objects?.nodes ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return nodes.map((node: any) => {
      const json = node?.asMoveObject?.contents?.json ?? {};
      return {
        id: node.address,
        name: json?.metadata?.name ?? "",
        status: json?.status?.status?.variant ?? "UNKNOWN",
      };
    });
  } catch {
    return [];
  }
}
