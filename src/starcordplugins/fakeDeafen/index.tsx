/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hyyven and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import ErrorBoundary from "@components/ErrorBoundary";
import { StarcordDevs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import definePlugin from "@utils/types";
import { findByProps, findComponentByCodeLazy } from "@webpack";

import Settings from "./settings";

const logger = new Logger("FakeDeafen");
const Button = findComponentByCodeLazy(".GREEN,positionKeyStemOverride:");
let enabled = false;
let originalSend: any;

function refreshVoiceState(enabled: boolean) {
    const ChannelStore = findByProps("getChannel", "getDMFromUserId");
    const SelectedChannelStore = findByProps("getVoiceChannelId");
    const wsModule = findByProps("getSocket");
    const MediaEngineStore = findByProps("isDeaf", "isMute");

    if (!wsModule) return logger.error("WebSocket Gateway not found");
    if (!SelectedChannelStore) return logger.error("SelectedChannelStore not found");

    const socket = wsModule.getSocket();
    const channelId = SelectedChannelStore.getVoiceChannelId();
    const channel = channelId ? ChannelStore?.getChannel(channelId) : null;

    if (socket && channelId) {
        try {
            // op code 4 = voiceStateUpdate
            socket.send(4, {
                guild_id: channel?.guild_id ?? null,
                channel_id: channelId,
                self_mute: (enabled && Settings.store.fakeMute) || (MediaEngineStore?.isMute() ?? false),
                self_deaf: (enabled && Settings.store.fakeDeafen) || (MediaEngineStore?.isDeaf() ?? false),
                self_video: false,
                flags: 0
            });
            logger.info("Voice state updated to", enabled ? "fake deafen" : "normal");
        } catch (error) {
            logger.error("Failed to update voice state:", error);
        }
    }
}

function FakeDeafenIcon() {
    const iconColor = enabled ? "#ed4245" : "currentColor";

    return (
        <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
            <rect x="6" y="8" width="20" height="4" rx="2" fill={iconColor} />
            <rect x="11" y="3" width="10" height="8" rx="3" fill={iconColor} />
            {enabled ? (
                <>
                    <line x1="7" y1="18" x2="13" y2="24" stroke={iconColor} strokeWidth="2" />
                    <line x1="13" y1="18" x2="7" y2="24" stroke={iconColor} strokeWidth="2" />
                    <line x1="19" y1="18" x2="25" y2="24" stroke={iconColor} strokeWidth="2" />
                    <line x1="25" y1="18" x2="19" y2="24" stroke={iconColor} strokeWidth="2" />
                    <path d="M14 23c1-1 3-1 4 0" stroke={iconColor} strokeWidth="2" strokeLinecap="round" />
                </>
            ) : (
                <>
                    <circle cx="10" cy="21" r="4" stroke={iconColor} strokeWidth="2" fill="none" />
                    <circle cx="22" cy="21" r="4" stroke={iconColor} strokeWidth="2" fill="none" />
                    <path d="M14 21c1 1 3 1 4 0" stroke={iconColor} strokeWidth="2" strokeLinecap="round" />
                </>
            )}
        </svg>
    );
}

function toggleEnabled() {
    enabled = !enabled;
    refreshVoiceState(enabled);
}

function handleKeyDown(event: KeyboardEvent) {
    if (Settings.store.enableKeybind && event.ctrlKey && event.shiftKey && event.code === "KeyQ") {
        event.preventDefault();
        toggleEnabled();
    }
}

function FakeDeafenButton(props: { nameplate?: any; }) {
    return (
        <Button
            tooltipText={enabled ? "Disable Fake Deafen" : "Enable Fake Deafen"}
            icon={FakeDeafenIcon}
            role="switch"
            aria-checked={enabled}
            redGlow={enabled}
            plated={props?.nameplate != null}
            onClick={toggleEnabled}
        />
    );
}

export default definePlugin({
    name: "FakeDeafen",
    description: "Fake deafen yourself. You appear deafened and/or muted to others, but you can still hear and speak.",
    authors: [StarcordDevs.hyyven],
    settings: Settings,

    start() {
        const wsModule = findByProps("getSocket");
        if (!wsModule) return logger.error("WebSocket module not found");

        const socket = wsModule.getSocket();
        if (!socket) return logger.error("Socket not found");

        originalSend = socket.send;
        socket.send = function (op: number, data: any, ...args: any[]) {
            // op code 4 = voiceStateUpdate
            if (op === 4 && enabled && data) {
                if (Settings.store.fakeMute) data.self_mute = true;
                if (Settings.store.fakeDeafen) data.self_deaf = true;
            }
            return originalSend.apply(this, [op, data, ...args]);
        };
        window.addEventListener("keydown", handleKeyDown);
    },

    stop() {
        const wsModule = findByProps("getSocket");
        if (wsModule) {
            const socket = wsModule.getSocket();
            if (socket && originalSend) {
                socket.send = originalSend;
            }
        }
        window.removeEventListener("keydown", handleKeyDown);
    },

    patches: [
        {
            find: "#{intl::USER_PROFILE_ACCOUNT_POPOUT_BUTTON_A11Y_LABEL}",
            predicate: () => Settings.store.showButton,
            replacement: {
                match: /children:\[(?=[^}]*accountContainerRef)/,
                replace: "children:[$self.FakeDeafenButton(arguments[0]),"
            }
        }
    ],

    FakeDeafenButton: ErrorBoundary.wrap(FakeDeafenButton, { noop: true }),
});
