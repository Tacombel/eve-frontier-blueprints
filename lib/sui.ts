import { prisma } from "@/lib/prisma";

const SUI_RPC = "https://fullnode.testnet.sui.io:443";
const EF_WORLD_API = "https://world-api-stillness.live.tech.evefrontier.com";

export interface SsuInventoryItem {
  typeId: number;
  name: string;
  quantity: number;
  volume: number;
  groupName: string;
  categoryName: string;
}

export interface SsuInventory {
  address: string;
  name: string;
  status: string;
  usedCapacity: number;
  maxCapacity: number;
  items: SsuInventoryItem[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function suiRpc(method: string, params: unknown[]): Promise<any> {
  const res = await fetch(SUI_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`Sui RPC HTTP error: ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message ?? "Sui RPC error");
  return data.result;
}

interface EfType {
  id: number;
  name: string;
  groupName: string;
  categoryName: string;
}

async function getEfTypes(): Promise<Map<number, EfType>> {
  const res = await fetch(`${EF_WORLD_API}/v2/types?limit=500&offset=0`);
  if (!res.ok) throw new Error(`EF World API error: ${res.status}`);
  const data = await res.json();
  const map = new Map<number, EfType>();
  for (const t of data.data ?? []) {
    map.set(t.id, { id: t.id, name: t.name, groupName: t.groupName, categoryName: t.categoryName });
  }
  return map;
}

export async function getSsuInventory(address: string): Promise<SsuInventory> {
  // Load type names in parallel with SSU fetch
  const [ssuResult, typeMap] = await Promise.all([
    suiRpc("sui_getObject", [address, { showContent: true, showType: true }]),
    getEfTypes(),
  ]);

  if (ssuResult.error || !ssuResult.data) throw new Error(`Object not found: ${address}`);
  const fields = ssuResult.data?.content?.fields;
  if (!fields) throw new Error("Invalid SSU object or not a StorageUnit");

  const name: string = fields.metadata?.fields?.name ?? "";
  const status: string = fields.status?.fields?.status?.variant ?? "UNKNOWN";

  // Step 2: get dynamic fields (the Inventory wrappers)
  const dynResult = await suiRpc("suix_getDynamicFields", [address, null, 50]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inventoryObjectIds: string[] = dynResult.data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((df: any) => df.objectType?.includes("::inventory::Inventory"))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((df: any) => df.objectId as string);

  if (inventoryObjectIds.length === 0) {
    return { address, name, status, usedCapacity: 0, maxCapacity: 0, items: [] };
  }

  // Step 3: fetch each Inventory object
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inventoryObjs: any[] = await suiRpc("sui_multiGetObjects", [
    inventoryObjectIds,
    { showContent: true },
  ]);

  const allItems: SsuInventoryItem[] = [];
  let usedCapacity = 0;
  let maxCapacity = 0;

  for (const obj of inventoryObjs) {
    const inv = obj.data?.content?.fields?.value?.fields;
    if (!inv) continue;

    usedCapacity += parseInt(inv.used_capacity ?? "0") / 100;
    maxCapacity = Math.max(maxCapacity, parseInt(inv.max_capacity ?? "0") / 100);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const entry of inv.items?.fields?.contents ?? []) {
      const item = entry.fields?.value?.fields;
      if (item) {
        const typeId = parseInt(item.type_id);
        const efType = typeMap.get(typeId);
        allItems.push({
          typeId,
          name: efType?.name ?? `Type ${typeId}`,
          quantity: parseInt(item.quantity),
          volume: parseInt(item.volume) / 100,
          groupName: efType?.groupName ?? "",
          categoryName: efType?.categoryName ?? "",
        });
      }
    }
  }

  allItems.sort((a, b) => a.typeId - b.typeId);

  return { address, name, status, usedCapacity, maxCapacity, items: allItems };
}

/**
 * Fetch a user's SSU inventory from the chain and return a Map<itemId, quantity>
 * keyed by the DB item CUID, matched via typeId.
 * Returns an empty map if the user has no ssuAddress configured.
 */
export async function fetchUserStockMap(userId: string): Promise<Map<string, number>> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { ssuAddress: true } });
  if (!user?.ssuAddress) return new Map();

  const inventory = await getSsuInventory(user.ssuAddress);

  // Build typeId -> quantity map from SSU
  const byTypeId = new Map<number, number>();
  for (const item of inventory.items) {
    byTypeId.set(item.typeId, (byTypeId.get(item.typeId) ?? 0) + item.quantity);
  }

  // Match to DB item CUIDs via typeId
  const dbItems = await prisma.item.findMany({
    where: { typeId: { not: null } },
    select: { id: true, typeId: true },
  });

  const stockMap = new Map<string, number>();
  for (const dbItem of dbItems) {
    const qty = byTypeId.get(dbItem.typeId!);
    if (qty !== undefined) stockMap.set(dbItem.id, qty);
  }

  return stockMap;
}
