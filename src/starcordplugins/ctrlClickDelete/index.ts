/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { StarcordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { FluxDispatcher, MessageActions, UserStore } from "@webpack/common";

export default definePlugin({
    name: "CtrlClickDelete",
    description: "Hold Ctrl and left click one of your messages to delete it instantly.",
    tags: ["Chat", "Utility"],
    authors: [StarcordDevs.Starcord],

    onMessageClick(msg, channel, event) {
        if (!event.ctrlKey || event.button !== 0) return;
        if (msg.author.id !== UserStore.getCurrentUser().id) return;
        if (event.target instanceof Element && event.target.closest("a, button, [role='button']")) return;

        event.preventDefault();

        if (msg.deleted) {
            FluxDispatcher.dispatch({ type: "MESSAGE_DELETE", channelId: channel.id, id: msg.id, mlDeleted: true });
        } else {
            MessageActions.deleteMessage(channel.id, msg.id);
        }
    }
});
