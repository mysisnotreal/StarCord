/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import { Notice } from "@components/Notice";
import { StarcordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { Channel, User, VoiceState } from "@vencord/discord-types";
import { findByPropsLazy } from "@webpack";
import { Menu, React, RelationshipStore, UserStore, VoiceStateStore } from "@webpack/common";

type TFollowedUserInfo = {
    lastChannelId: string;
    userId: string;
} | null;

interface UserContextProps {
    channel: Channel;
    user: User;
    guildId?: string;
}

let followedUserInfo: TFollowedUserInfo = null;

const followListeners = new Set<(userId: string | null) => void>();

export const getFollowedUserId = () => followedUserInfo?.userId ?? null;

export function setFollowedUser(userId: string | null) {
    followedUserInfo = userId
        ? { lastChannelId: UserStore.getCurrentUser().id, userId }
        : null;
    followListeners.forEach(listener => listener(userId));
}

export function addFollowListener(listener: (userId: string | null) => void) {
    followListeners.add(listener);
    return () => void followListeners.delete(listener);
}

const voiceChannelAction = findByPropsLazy("selectVoiceChannel");

const settings = definePluginSettings({
    onlyWhenInVoice: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Only follow the user when you are in a voice channel"
    },
    leaveWhenUserLeaves: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Leave the voice channel when the user leaves. (That can cause you to sometimes enter infinite leave/join loop)"
    }
});

const UserContextMenuPatch: NavContextMenuPatchCallback = (children, { channel, user }: UserContextProps) => {
    if (UserStore.getCurrentUser().id === user.id || !RelationshipStore.getFriendIDs().includes(user.id)) return;

    const [checked, setChecked] = React.useState(followedUserInfo?.userId === user.id);

    children.push(
        <Menu.MenuSeparator />,
        <Menu.MenuCheckboxItem
            id="fvu-follow-user"
            label="Follow User"
            checked={checked}
            action={() => {
                const following = followedUserInfo?.userId === user.id;
                setFollowedUser(following ? null : user.id);
                setChecked(!following);
            }}
        ></Menu.MenuCheckboxItem>
    );
};

export default definePlugin({
    name: "FollowVoiceUser",
    description: "Follow a friend in voice chat.",
    tags: ["Voice"],
    authors: [StarcordDevs.TheArmagan],
    settings,
    settingsAboutComponent: () => (
        <Notice.Info>
            This Plugin is used to follow a Friend/Friends into voice chat(s).
        </Notice.Info>
    ),
    flux: {
        async VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: VoiceState[]; }) {
            if (!followedUserInfo) return;
            if (!RelationshipStore.getFriendIDs().includes(followedUserInfo.userId)) return;

            if (
                settings.store.onlyWhenInVoice
                && !VoiceStateStore.getVoiceStateForUser(UserStore.getCurrentUser().id)
            ) return;

            voiceStates.forEach(voiceState => {
                if (
                    voiceState.userId === followedUserInfo!.userId
                    && voiceState.channelId
                    && voiceState.channelId !== followedUserInfo!.lastChannelId
                ) {
                    followedUserInfo!.lastChannelId = voiceState.channelId;
                    voiceChannelAction.selectVoiceChannel(followedUserInfo!.lastChannelId);
                } else if (
                    voiceState.userId === followedUserInfo!.userId
                    && !voiceState.channelId
                    && settings.store.leaveWhenUserLeaves
                ) {
                    voiceChannelAction.selectVoiceChannel(null);
                }
            });
        }
    },
    contextMenus: {
        "user-context": UserContextMenuPatch
    }
});
