/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { GuildMember } from "@vencord/discord-types";
import { AuthenticationStore, GuildMemberStore, UserStore } from "@webpack/common";

import { settings } from "./settings";

type NameKey = "username" | "globalName";

// your id from the last session covers your own user being created before Discord knows who is logged in
const isMe = (userId: unknown) => userId != null && (userId === AuthenticationStore.getId() || userId === settings.store.userId);
const customName = (key: NameKey) => ((key === "username" ? settings.store.username : settings.store.displayName) ?? "").trim() || null;
const nickname = () => customName("globalName") ?? customName("username");

// Your real names, kept so clearing a name brings it back right away
const realNames: Partial<Record<NameKey, string | null>> = {};
// Every custom name handed out, so a copy of a renamed user is never mistaken for your real name
const handedOut = new Set<string>();

function learnRealName(key: NameKey, value: unknown) {
    if (value === undefined || (typeof value === "string" && handedOut.has(value))) return;
    if (key === "username" && !value) return;
    realNames[key] = value as string | null;
}

export const getRealNames = () => realNames;

export function refreshNames() {
    UserStore.emitChange();
    GuildMemberStore.emitChange();
}

/** Turns your user's names into live values, so changing them updates everything right away */
export function attachNames(user: Record<NameKey, unknown>, data: { id?: string; }) {
    if (!isMe(data?.id)) return;

    learnRealName("username", user.username);
    for (const key of ["username", "globalName"] as const) {
        Object.defineProperty(user, key, {
            configurable: true,
            enumerable: true,
            get() {
                const custom = customName(key);
                if (custom) handedOut.add(custom);
                return custom ?? realNames[key];
            },
            set(value) {
                learnRealName(key, value);
            }
        });
    }
}

const renamedMembers = new WeakMap<GuildMember, { name: string; member: GuildMember; }>();
const originalStoreMethods: Partial<Pick<typeof GuildMemberStore, "getMember" | "getNick">> = {};

/** Shows your display name instead of your server nicknames */
export function startNicknames() {
    const { getMember, getNick } = GuildMemberStore;
    Object.assign(originalStoreMethods, { getMember, getNick });

    GuildMemberStore.getMember = function (guildId, userId) {
        const member = getMember.call(this, guildId, userId);
        const name = isMe(userId) ? nickname() : null;
        if (!member?.nick || !name) return member;

        // the same member always maps to the same copy, so React doesn't see a new value on every render
        const cached = renamedMembers.get(member);
        if (cached?.name === name) return cached.member;

        const renamed = { ...member, nick: name };
        renamedMembers.set(member, { name, member: renamed });
        return renamed;
    };

    GuildMemberStore.getNick = function (guildId, userId) {
        const nick = getNick.call(this, guildId, userId);
        const name = isMe(userId) ? nickname() : null;
        return nick && name ? name : nick;
    };
}

export function stopNicknames() {
    Object.assign(GuildMemberStore, originalStoreMethods);
}
