/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { isPluginEnabled } from "@api/PluginManager";
import ErrorBoundary from "@components/ErrorBoundary";
import userVoiceShow from "@plugins/userVoiceShow";
import { StarcordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import definePlugin from "@utils/types";
import { ChannelRouter, ChannelStore, GuildStore, PermissionsBits, PermissionStore, Tooltip, useStateFromStores, VoiceStateStore } from "@webpack/common";

const cl = classNameFactory("vc-dm-voice-view-");

function SpeakerIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M12 3a1 1 0 0 0-1.7-.7L6.6 6H4a2 2 0 0 0-2 2v8c0 1.1.9 2 2 2h2.6l3.7 3.7A1 1 0 0 0 12 21V3ZM15.1 20.75c-.58.14-1.1-.33-1.1-.92v-.03c0-.5.37-.92.85-1.05a7 7 0 0 0 0-13.5A1.1 1.1 0 0 1 14 4.2v-.03c0-.6.52-1.06 1.1-.92a9 9 0 0 1 0 17.5Z" />
            <path fill="currentColor" d="M15.16 16.51c-.57.28-1.16-.2-1.16-.83v-.14c0-.43.28-.8.63-1.02a3 3 0 0 0 0-5.04c-.35-.23-.63-.6-.63-1.02v-.14c0-.63.59-1.1 1.16-.83a5 5 0 0 1 0 9.02Z" />
        </svg>
    );
}

const DMVoiceIcon = ErrorBoundary.wrap(({ userId }: { userId: string; }) => {
    const channelId = useStateFromStores([VoiceStateStore], () => VoiceStateStore.getVoiceStateForUser(userId)?.channelId ?? null);
    const channel = channelId ? ChannelStore.getChannel(channelId) : null;
    if (!channel) return null;
    if (!channel.isPrivate() && !PermissionStore.can(PermissionsBits.VIEW_CHANNEL, channel)) return null;

    const guild = channel.guild_id ? GuildStore.getGuild(channel.guild_id) : null;
    const location = guild ? `${channel.name} in ${guild.name}` : "a call";

    return (
        <Tooltip text={`In ${location}. Click to view.`}>
            {props => (
                <div
                    {...props}
                    role="button"
                    aria-label={`View ${location}`}
                    className={cl("icon")}
                    onClick={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        ChannelRouter.transitionToChannel(channel.id);
                    }}
                >
                    <SpeakerIcon />
                </div>
            )}
        </Tooltip>
    );
}, { noop: true });

export default definePlugin({
    name: "DMVoiceView",
    description: "Shows a speaker icon next to people in your direct messages who are in a voice channel. Click it to view the voice channel they are in.",
    tags: ["Voice", "Friends"],
    authors: [StarcordDevs.Starcord],
    dependencies: ["MemberListDecoratorsAPI"],

    renderMemberListDecorator({ type, user }) {
        if (type !== "dm" || !user) return null;
        if (isPluginEnabled(userVoiceShow.name) && userVoiceShow.settings?.store.showInMemberList) return null;

        return <DMVoiceIcon userId={user.id} />;
    }
});
