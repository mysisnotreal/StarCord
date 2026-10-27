/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Button } from "@components/Button";
import { Flex } from "@components/Flex";
import { Notice } from "@components/Notice";
import { Paragraph } from "@components/Paragraph";
import { OptionType } from "@utils/types";
import { showToast, UserStore, useState } from "@webpack/common";

import { isConfigured, joinStarcord, leaveStarcord, logger, useStarcordUser } from "./api";

function MembershipSettings() {
    const user = useStarcordUser(UserStore.getCurrentUser()?.id ?? "");
    const [busy, setBusy] = useState(false);

    if (!isConfigured()) {
        return <Notice.Info>The Starcord user list isn't set up yet, so your badges only show on your own client.</Notice.Info>;
    }

    async function leave() {
        setBusy(true);
        try {
            await leaveStarcord();
            showToast({ text: "You left the Starcord user list", variant: "success" });
        } catch (err) {
            logger.error("Failed to leave the Starcord user list", err);
            showToast({ text: err instanceof Error ? err.message : "Couldn't leave the Starcord user list", variant: "critical" });
        }
        setBusy(false);
    }

    return (
        <Flex flexDirection="column" gap="8px">
            <Paragraph>
                {user
                    ? `You're Starcord user #${user.number}. Other Starcord users can see your number and badges.`
                    : "Join the Starcord user list to get your number and show your badges to other Starcord users. Discord asks you to confirm it's your account."}
            </Paragraph>
            <Flex gap="8px">
                {user
                    ? <Button variant="dangerSecondary" disabled={busy} onClick={leave}>Leave the Starcord user list</Button>
                    : <Button onClick={() => joinStarcord(settings.store.badges ?? [])}>Join the Starcord user list</Button>}
            </Flex>
        </Flex>
    );
}

export const settings = definePluginSettings({
    membership: {
        type: OptionType.COMPONENT,
        component: MembershipSettings
    },
    showTags: {
        type: OptionType.BOOLEAN,
        description: "Show a star with their number next to Starcord users in the member list, direct messages and voice channels.",
        default: true
    }
}).withPrivateSettings<{
    badges?: string[];
    askedToJoin?: boolean;
    displayName?: string;
    username?: string;
    userId?: string;
}>();
