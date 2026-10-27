/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";
import { Logger } from "@utils/Logger";
import { OAuth2AuthorizeModal, openModal, showToast, useEffect, UserProfileStore, UserStore, useState } from "@webpack/common";

import { BadgesById } from "./badges";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";

export interface StarcordUser {
    number: number;
    badges: string[];
}

export const logger = new Logger("StarcordUsers");

const TOKENS_KEY = "StarcordUsers_tokens";
const PAGE_SIZE = 1000;
const MAX_USERS = 200_000;

let users = new Map<string, StarcordUser>();
const listeners = new Set<() => void>();
function emitChange() {
    listeners.forEach(listener => listener());
    // redraws open profiles so new badges show up right away
    UserProfileStore.emitChange();
}

export const isConfigured = () => /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(SUPABASE_URL) && SUPABASE_PUBLISHABLE_KEY.length > 0;
const functionUrl = (path: string) => `${SUPABASE_URL}/functions/v1/starcord${path}`;
const currentUserId = () => UserStore.getCurrentUser()?.id;

export const getStarcordUser = (userId: string) => users.get(userId);

export function useStarcordUser(userId: string) {
    const [user, setUser] = useState(() => users.get(userId));

    useEffect(() => {
        const update = () => setUser(users.get(userId));
        update();
        listeners.add(update);
        return () => void listeners.delete(update);
    }, [userId]);

    return user;
}

function parseRow(row: any): [string, StarcordUser] | null {
    if (typeof row?.user_id !== "string" || !/^\d{17,20}$/.test(row.user_id)) return null;
    if (!Number.isSafeInteger(row.number) || row.number < 1) return null;
    return [row.user_id, { number: row.number, badges: cleanBadges(row.badges) }];
}

function cleanBadges(badges: unknown) {
    return Array.isArray(badges)
        ? badges.filter((b): b is string => typeof b === "string" && BadgesById.has(b) && !BadgesById.get(b)!.localOnly).slice(0, 40)
        : [];
}

export async function refreshUsers() {
    if (!isConfigured()) return;

    const next = new Map<string, StarcordUser>();
    const headers: Record<string, string> = { apikey: SUPABASE_PUBLISHABLE_KEY };
    // legacy anon keys are JWTs and have to be sent as a bearer token too
    if (SUPABASE_PUBLISHABLE_KEY.startsWith("eyJ")) headers.Authorization = `Bearer ${SUPABASE_PUBLISHABLE_KEY}`;

    for (let from = 0; from < MAX_USERS; from += PAGE_SIZE) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/starcord_users?select=user_id,number,badges&order=number.asc`, {
            headers: { ...headers, "Range-Unit": "items", Range: `${from}-${from + PAGE_SIZE - 1}` }
        });
        if (!res.ok) throw new Error(`Failed to load Starcord users: ${res.status}`);

        const rows: unknown = await res.json();
        if (!Array.isArray(rows)) throw new Error("Unexpected response while loading Starcord users");

        for (const row of rows) {
            const user = parseRow(row);
            if (user) next.set(...user);
        }

        if (rows.length < PAGE_SIZE) break;
    }

    users = next;
    emitChange();
}

async function getToken() {
    const userId = currentUserId();
    return userId ? (await DataStore.get<Record<string, string>>(TOKENS_KEY))?.[userId] : undefined;
}

async function setToken(userId: string, token: string | null) {
    await DataStore.update<Record<string, string>>(TOKENS_KEY, tokens => {
        tokens ??= {};
        if (token) tokens[userId] = token;
        else delete tokens[userId];
        return tokens;
    });
}

export const hasJoined = async () => !!await getToken();

async function readError(res: Response) {
    const data = await res.json().catch(() => null);
    return typeof data?.error === "string" ? data.error : `Request failed (${res.status})`;
}

export async function uploadBadges(badges: string[]) {
    const token = await getToken();
    const userId = currentUserId();
    if (!token || !userId || !isConfigured()) return;

    const res = await fetch(functionUrl("/badges"), {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ badges: cleanBadges(badges) })
    });

    if (res.status === 401) await setToken(userId, null);
    if (!res.ok) throw new Error(await readError(res));

    const { badges: saved } = await res.json();
    const user = users.get(userId);
    if (user) {
        users.set(userId, { ...user, badges: cleanBadges(saved) });
        emitChange();
    }
}

/** Opens Discord's authorize screen to prove which account this is, then adds it to the Starcord user list */
export async function joinStarcord(badges: string[]) {
    if (!isConfigured()) return;

    let config: { clientId?: unknown; redirectUri?: unknown; };
    try {
        config = await fetch(functionUrl("/config")).then(res => res.json());
    } catch (err) {
        logger.error("Failed to load login settings", err);
        showToast({ text: "Couldn't reach the Starcord user list", variant: "critical" });
        return;
    }

    const { clientId, redirectUri } = config;
    if (typeof clientId !== "string" || !/^\d+$/.test(clientId) || redirectUri !== functionUrl("/callback")) {
        showToast({ text: "The Starcord user list is set up wrong", variant: "critical" });
        return;
    }

    openModal(props => (
        <OAuth2AuthorizeModal
            {...props}
            scopes={["identify"]}
            responseType="code"
            redirectUri={redirectUri}
            permissions={0n}
            clientId={clientId}
            cancelCompletesFlow={false}
            callback={async ({ location }: { location?: string; }) => {
                // only follow the redirect if it goes back to our own Edge Function
                if (!location?.startsWith(`${redirectUri}?`)) return;

                try {
                    const res = await fetch(location, { headers: { Accept: "application/json" } });
                    if (!res.ok) throw new Error(await readError(res));

                    const data = await res.json();
                    const userId = currentUserId();
                    if (data.userId !== userId || typeof data.token !== "string" || !Number.isSafeInteger(data.number))
                        throw new Error("The Starcord user list returned an unexpected account");

                    await setToken(userId, data.token);
                    users.set(userId, { number: data.number, badges: [] });
                    emitChange();
                    showToast({ text: `Welcome! You're Starcord user #${data.number}`, variant: "success" });

                    if (badges.length) await uploadBadges(badges);
                } catch (err) {
                    logger.error("Failed to join the Starcord user list", err);
                    showToast({ text: err instanceof Error ? err.message : "Couldn't join the Starcord user list", variant: "critical" });
                }
            }}
        />
    ));
}

export async function leaveStarcord() {
    const token = await getToken();
    const userId = currentUserId();
    if (!token || !userId) return;

    const res = await fetch(functionUrl("/me"), { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok && res.status !== 401) throw new Error(await readError(res));

    await setToken(userId, null);
    users.delete(userId);
    emitChange();
}

// Live updates through Supabase Realtime, so new users and badge changes show up instantly

const REALTIME_TOPIC = "realtime:starcord-users";
let socket: WebSocket | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | undefined;
let reconnectTimeout: ReturnType<typeof setTimeout> | undefined;
let reconnectDelay = 5000;
let liveRunning = false;

const send = (message: Record<string, unknown>) => socket?.readyState === WebSocket.OPEN && socket.send(JSON.stringify(message));

export function handleRealtimeMessage(message: any) {
    if (message?.event === "system" && message.payload?.status === "error") {
        logger.warn("Live updates are unavailable, the user list is reloaded every few minutes instead.", message.payload.message);
        return;
    }
    if (message?.event !== "postgres_changes") return;

    const change = message.payload?.data;
    if ((change?.type ?? change?.eventType) === "DELETE") {
        if (users.delete(change.old_record?.user_id)) emitChange();
        return;
    }

    const user = parseRow(change?.record);
    if (user) {
        users.set(...user);
        emitChange();
    }
}

function connect() {
    const url = `${SUPABASE_URL.replace(/^https:/, "wss:")}/realtime/v1/websocket?apikey=${encodeURIComponent(SUPABASE_PUBLISHABLE_KEY)}&vsn=1.0.0`;
    socket = new WebSocket(url);

    socket.onopen = () => {
        reconnectDelay = 5000;
        send({
            topic: REALTIME_TOPIC,
            event: "phx_join",
            ref: "1",
            join_ref: "1",
            payload: { config: { postgres_changes: [{ event: "*", schema: "public", table: "starcord_users" }] } }
        });
        heartbeatInterval = setInterval(() => send({ topic: "phoenix", event: "heartbeat", ref: String(Date.now()), payload: {} }), 25_000);
        // catches up on anything that changed while not connected
        refreshUsers().catch(err => logger.error("Failed to load Starcord users", err));
    };

    socket.onmessage = event => {
        try {
            handleRealtimeMessage(JSON.parse(event.data));
        } catch (err) {
            logger.error("Invalid live update", err);
        }
    };

    socket.onclose = () => {
        clearInterval(heartbeatInterval);
        if (!liveRunning) return;
        reconnectTimeout = setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, 60_000);
    };
}

export function startLiveUpdates() {
    if (!isConfigured() || liveRunning) return;
    liveRunning = true;
    connect();
}

export function stopLiveUpdates() {
    liveRunning = false;
    clearInterval(heartbeatInterval);
    clearTimeout(reconnectTimeout);
    socket?.close();
    socket = null;
}
