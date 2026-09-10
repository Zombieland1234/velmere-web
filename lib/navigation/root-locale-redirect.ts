import { redirect } from "next/navigation";

type SearchValue = string | string[] | undefined;

export type RootAliasSearchParams = Record<string, SearchValue>;

function appendSearchParam(query: URLSearchParams, key: string, value: SearchValue) {
  if (Array.isArray(value)) {
    for (const item of value) query.append(key, item);
    return;
  }
  if (typeof value === "string") query.set(key, value);
}

export async function redirectRootAlias(
  pathname: string,
  searchParams?: Promise<RootAliasSearchParams>,
) {
  const resolved = searchParams ? await searchParams : {};
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(resolved)) appendSearchParam(query, key, value);
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  redirect(`/pl${pathname}${suffix}`);
}
