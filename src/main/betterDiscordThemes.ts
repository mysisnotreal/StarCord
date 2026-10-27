/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { VENCORD_USER_AGENT_HASHLESS } from "@shared/vencordUserAgent";
import { writeFile } from "fs/promises";

import { THEMES_DIR } from "./utils/constants";
import { ensureSafePath } from "./utils/ensureSafePath";
import { checkedFetch } from "./utils/http";

const BD_ORIGIN = "https://betterdiscord.app";
const MAX_THEME_SIZE = 5 * 1024 * 1024;

export interface BetterDiscordTheme {
    id: number;
    name: string;
    description: string;
    author: string;
    downloads: number;
    likes: number;
    tags: string[];
    thumbnail: string | null;
    fileName: string;
}

const headers = { "User-Agent": VENCORD_USER_AGENT_HASHLESS };

export const toThemeFileName = (name: string) => name.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") + ".theme.css";

// The store page is a SvelteKit page whose data is serialized with devalue: a flat array where values reference other entries by index.
function hydrate(table: unknown[], index: number): any {
    if (index < 0) return null;

    const value = table[index];
    if (Array.isArray(value)) {
        if (typeof value[0] === "string") return value[1] ?? null;
        return value.map(i => hydrate(table, i));
    }
    if (value && typeof value === "object") {
        return Object.fromEntries(Object.entries(value).map(([k, i]) => [k, hydrate(table, i as number)]));
    }

    return value;
}

export async function getBetterDiscordThemes(): Promise<BetterDiscordTheme[]> {
    const res = await checkedFetch(`${BD_ORIGIN}/themes/__data.json`, { headers });
    const { nodes } = await res.json();

    const node = nodes.find(n => n?.type === "data" && n.data?.[0]?.addons != null);
    if (!node) throw new Error("Unexpected response from the BetterDiscord theme store");

    const addons: any[] = hydrate(node.data, node.data[0].addons);

    return addons.map(addon => ({
        id: addon.id,
        name: addon.name,
        description: addon.description ?? "",
        author: addon.author?.login?.displayName?.trim() || addon.author?.githubName || "Unknown Author",
        downloads: Number(addon.downloads) || 0,
        likes: Number(addon.likes) || 0,
        tags: addon.tags ?? [],
        thumbnail: addon.thumbnail?.id != null ? `${BD_ORIGIN}/image/${addon.thumbnail.id}` : null,
        fileName: toThemeFileName(addon.name)
    }));
}

export async function installBetterDiscordTheme(id: unknown, name: unknown) {
    if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0)
        return { success: false, error: "Invalid theme id." };
    if (typeof name !== "string" || !name.length || name.length > 100)
        return { success: false, error: "Invalid theme name." };

    const fileName = toThemeFileName(name);
    const path = ensureSafePath(THEMES_DIR, fileName);
    if (!path || fileName === ".theme.css")
        return { success: false, error: "Invalid theme name." };

    try {
        const res = await checkedFetch(`${BD_ORIGIN}/download?id=${id}`, { headers });
        const css = await res.text();
        if (css.length > MAX_THEME_SIZE)
            return { success: false, error: "Theme file is too large." };

        await writeFile(path, css);
        return { success: true, fileName };
    } catch {
        return { success: false, error: "Failed to download the theme." };
    }
}
