/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { addFollowListener, getFollowedUserId, setFollowedUser } from "@equicordplugins/followVoiceUser";
import { StarcordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { VoiceState } from "@vencord/discord-types";
import { ChannelActions, ChannelStore, showToast, UserStore, VoiceStateStore } from "@webpack/common";

const settings = definePluginSettings({
    joinOnFollow: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Join the user's voice channel as soon as you start following them, instead of waiting for them to move."
    },
    notifyOnMove: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Show a toast when the user you are following moves to another voice channel or leaves voice."
    },
    rememberFollowedUser: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Keep following the same user after restarting Discord."
    }
}).withPrivateSettings<{ followedUserId?: string | null; }>();

let lastSeenChannelId: string | null = null;
let removeFollowListener: (() => void) | null = null;

const getName = (userId: string) => {
    const user = UserStore.getUser(userId);
    return user?.globalName ?? user?.username ?? "The user you are following";
};

function onFollowChange(userId: string | null) {
    settings.store.followedUserId = userId;
    lastSeenChannelId = userId ? VoiceStateStore.getVoiceStateForUser(userId)?.channelId ?? null : null;

    if (!userId || !settings.store.joinOnFollow || !lastSeenChannelId) return;
    if (VoiceStateStore.getVoiceStateForUser(UserStore.getCurrentUser().id)?.channelId === lastSeenChannelId) return;

    ChannelActions.selectVoiceChannel(lastSeenChannelId);
}

export default definePlugin({
    name: "FollowVoiceUserEnhanced",
    description: "Improves FollowVoiceUser: joins the user's voice channel as soon as you follow them, notifies you when they move and remembers who you follow after a restart.",
    tags: ["Voice"],
    authors: [StarcordDevs.Starcord],
    dependencies: ["FollowVoiceUser"],
    settings,

    start() {
        removeFollowListener = addFollowListener(onFollowChange);

        const rememberedUserId = settings.store.followedUserId;
        if (settings.store.rememberFollowedUser && rememberedUserId && !getFollowedUserId())
            setFollowedUser(rememberedUserId);
    },

    stop() {
        removeFollowListener?.();
        removeFollowListener = null;
    },

    flux: {
        VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: VoiceState[]; }) {
            const followedUserId = getFollowedUserId();
            if (!followedUserId) return;

            const voiceState = voiceStates.find(state => state.userId === followedUserId);
            if (!voiceState || voiceState.channelId === lastSeenChannelId) return;

            lastSeenChannelId = voiceState.channelId ?? null;
            if (!settings.store.notifyOnMove) return;

            const channel = voiceState.channelId ? ChannelStore.getChannel(voiceState.channelId) : null;
            showToast({
                text: channel
                    ? `${getName(followedUserId)} moved to ${channel.name}`
                    : `${getName(followedUserId)} left voice`
            });
        }
    }
});
