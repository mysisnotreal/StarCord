/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./VencordTab.css";

import { openNotificationLogModal } from "@api/Notifications/notificationLog";
import { useSettings } from "@api/Settings";
import { Button } from "@components/Button";
import { Divider } from "@components/Divider";
import { FormSwitch } from "@components/FormSwitch";
import { Heading } from "@components/Heading";
import { FolderIcon, GithubIcon, LogIcon, PaintbrushIcon, RestartIcon } from "@components/Icons";
import { Notice } from "@components/Notice";
import { Paragraph } from "@components/Paragraph";
import { openContributorModal, openPluginModal, SettingsTab, wrapTab } from "@components/settings";
import { QuickAction, QuickActionCard } from "@components/settings/QuickAction";
import { SpecialCard } from "@components/settings/SpecialCard";
import BadgeAPI from "@plugins/_api/badges";
import NoTrack from "@plugins/_core/noTrack";
import SettingsPlugin from "@plugins/_core/settings";
import { gitRemote } from "@shared/vencordUserAgent";
import { DONOR_ROLE_ID, GUILD_ID, IS_WINDOWS, VC_DONOR_ROLE_ID, VC_GUILD_ID } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { Margins } from "@utils/margins";
import { isAnyPluginDev } from "@utils/misc";
import { relaunch } from "@utils/native";
import { promptToRestart } from "@utils/promptToRestart";
import { GuildMemberStore, React, UserStore } from "@webpack/common";
import starcordIcon from "file://starcord.png?base64";

import { InviteButtonComponent } from "./DonateButton";
import { MacOSVibrancySettings } from "./MacVibrancySettings";
import { NotificationSection } from "./NotificationSettings";
import { WindowsMaterialSettings } from "./WindowsMaterialSettings";

const STARCORD_IMAGE = `data:image/png;base64,${starcordIcon}`;

function starPolygon(x: number, y: number, size: number) {
    const points = Array.from({ length: 10 }, (_, i) => {
        const radius = i % 2 ? size * 0.45 : size;
        const angle = (Math.PI / 5) * i - Math.PI / 2;
        return `${(x + radius * Math.cos(angle)).toFixed(1)},${(y + radius * Math.sin(angle)).toFixed(1)}`;
    });
    return `<polygon points="${points.join(" ")}"/>`;
}

const STARS: [x: number, y: number, size: number][] = [
    [30, 28, 9], [95, 160, 6], [150, 60, 5], [205, 175, 8], [250, 25, 6], [300, 110, 4],
    [345, 165, 7], [390, 40, 9], [430, 125, 5], [470, 185, 6], [500, 70, 7], [545, 140, 9],
    [575, 30, 5], [120, 105, 4], [20, 120, 6], [270, 70, 3], [420, 90, 3], [590, 190, 4]
];

const STAR_BACKGROUND = "data:image/svg+xml," + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 200" preserveAspectRatio="xMidYMid slice"><g fill="#ffd84d">${STARS.map(([x, y, size]) => starPolygon(x, y, size)).join("")}</g></svg>`
);

const VENNIE_DONATOR_IMAGE = "https://cdn.discordapp.com/emojis/1238120638020063377.png";
const COZY_CONTRIB_IMAGE = "https://cdn.discordapp.com/emojis/1026533070955872337.png";

const DONOR_BACKGROUND_IMAGE = "https://media.discordapp.net/stickers/1311070116305436712.png?size=2048";
const CONTRIB_BACKGROUND_IMAGE = "https://media.discordapp.net/stickers/1311070166481895484.png?size=2048";

const cl = classNameFactory("vc-vencord-tab-");

type KeysOfType<Object, Type> = {
    [K in keyof Object]: Object[K] extends Type ? K : never;
}[keyof Object];

function Switches() {
    const settings = useSettings(["useQuickCss", "optimizedDiscord", "enableReactDevtools", "mainWindowFrameless", "frameless", "nativeTitleBar", "transparent", "winCtrlQ", "disableMinSize"]);
    const { disableAnalytics } = NoTrack.settings.use(["disableAnalytics"]);

    const Switches = [
        {
            key: "useQuickCss",
            title: "Enable Custom CSS",
            description: "Apply your configured QuickCSS"
        },
        {
            key: "optimizedDiscord",
            title: "Optimized Discord",
            description: "Removes all animations, including animated profile pictures, server icons, banners, avatar decorations, nameplates, profile effects and status emojis, and turns on reduced motion. This makes Discord feel snappier and use less resources.",
            restartRequired: true
        },
        {
            value: disableAnalytics,
            updateSetting(newValue) {
                NoTrack.settings.store.disableAnalytics = newValue;
            },
            reactKey: "NoTrack::disableAnalytics",
            key: null!,
            title: "Block Discord Analytics",
            description: NoTrack.settings.def.disableAnalytics.description,
            restartRequired: NoTrack.settings.def.disableAnalytics.restartNeeded,
        },
        (!IS_WEB && !IS_DISCORD_DESKTOP || !IS_WINDOWS) && {
            key: "mainWindowFrameless",
            title: "Disable the Main Window Frame",
            description: "Remove the native window frame for a cleaner look. You can still move the window by dragging the title bar area.",
            restartRequired: true,
        },
        !IS_WEB && (!IS_DISCORD_DESKTOP || !IS_WINDOWS
            ? {
                key: "frameless",
                title: "Disable All Window Frames",
                description: "Remove the native window frame for a cleaner look. You can still move the window by dragging the title bar area.",
                restartRequired: true,
            }
            : {
                key: "nativeTitleBar",
                title: "Use Windows' native title bar instead of Discord's custom one",
                description: "Replace Discord's custom title bar with the standard Windows title bar. This may improve compatibility with some window management tools.",
                restartRequired: true,
            }
        ),
        !IS_WEB && {
            key: "transparent",
            title: "Enable Window Transparency",
            description: "Make the Discord window transparent. A theme that supports transparency is required or this will do nothing.",
            restartRequired: true,
            warning: IS_WINDOWS
                ? "This will stop the window from being resizable and prevents you from snapping the window to screen edges."
                : "This will stop the window from being resizable.",
        },
        IS_DISCORD_DESKTOP && {
            key: "disableMinSize",
            title: "Disable Minimum Window Size",
            description: "Allows you to resize the window to any size, even smaller than Discord's minimum size",
            restartRequired: true
        },
        !IS_WEB && IS_WINDOWS && {
            key: "winCtrlQ",
            title: "Register Ctrl+Q as shortcut to close Discord",
            description: "Add Ctrl+Q as a keyboard shortcut to close Discord. This provides an alternative to Alt+F4 for quickly closing the application.",
            restartRequired: true,
        },
        !IS_WEB && {
            key: "enableReactDevtools",
            title: "Enable React Developer Tools",
            description: "Mainly useful for plugin developers. Ignore this if you don't know what it is",
            restartRequired: true
        },
    ] satisfies Array<false | {
        key: KeysOfType<typeof settings, boolean>;
        reactKey?: string;
        title: string;
        description?: string;
        restartRequired?: boolean;
        warning?: string;
        updateSetting?(newValue: boolean): void;
        value?: boolean;
    }>;

    return Switches.map(setting => {
        if (!setting) {
            return null;
        }

        const { reactKey, key, value, title, description, restartRequired, warning, updateSetting = v => (settings[key] = v) } = setting;

        return (
            <FormSwitch
                key={reactKey ?? key}
                title={title}
                description={
                    warning ? (
                        <>
                            {description}
                            <Notice.Warning className={Margins.top8} style={{ width: "100%" }}>
                                {warning}
                            </Notice.Warning>
                        </>
                    ) : (
                        description
                    )
                }
                value={value ?? settings[key]}
                hideBorder
                onChange={v => {
                    updateSetting(v);

                    if (restartRequired) {
                        promptToRestart("relaunch");
                    }
                }}
            />
        );
    });
}

function StarcordSettings() {
    const user = UserStore?.getCurrentUser();

    return (
        <SettingsTab>
            {(isStarcordDonor(user?.id) || isVencordDonor(user?.id)) ? (
                <SpecialCard
                    title="Donations"
                    subtitle="Thank you for donating!"
                    description={
                        isStarcordDonor(user?.id) && isVencordDonor(user?.id)
                            ? "All Vencord users can see your Vencord donor badge, and Equicord and Starcord users can see your Equicord donor badge. To change your Vencord donor badge, contact @vending.machine. For your Equicord donor badge, make a ticket in Equicord's server."
                            : isVencordDonor(user?.id)
                                ? "All Vencord users can see your badge! You can manage your perks by messaging @vending.machine."
                                : "All Equicord and Starcord users can see your badge! You can manage your perks by making a ticket in Equicord's server."
                    }
                    cardImage={VENNIE_DONATOR_IMAGE}
                    backgroundImage={DONOR_BACKGROUND_IMAGE}
                    backgroundColor="#ED87A9"
                >
                    <InviteButtonComponent donated={true} />
                </SpecialCard>
            ) : (
                <SpecialCard
                    title="Starcord Community"
                    description="Join the Starcord Discord server to chat, get help and see what's coming next!"
                    cardImage={STARCORD_IMAGE}
                    backgroundImage={STAR_BACKGROUND}
                    backgroundColor="#a8dcf7"
                >
                    <InviteButtonComponent />
                </SpecialCard>
            )}
            {isAnyPluginDev(user?.id) && (
                <SpecialCard
                    title="Contributions"
                    subtitle="Thank you for contributing!"
                    description="Since you've contributed to Starcord you now have a cool new badge!"
                    cardImage={COZY_CONTRIB_IMAGE}
                    backgroundImage={CONTRIB_BACKGROUND_IMAGE}
                    backgroundColor="#EDCC87"
                >
                    <Button
                        variant="none"
                        size="medium"
                        type="button"
                        onClick={() => openContributorModal(user)}
                        className="vc-contrib-button"
                    >
                        <GithubIcon aria-hidden fill={"#000000"} className={"vc-contrib-github"} />
                        See what you've contributed to
                    </Button>
                </SpecialCard>
            )}

            <Heading className={Margins.top16}>Quick Actions</Heading>
            <Paragraph className={Margins.bottom16}>
                Common actions you might want to perform. These shortcuts give you quick access to frequently used features without navigating through menus.
            </Paragraph>

            <QuickActionCard>
                <QuickAction
                    Icon={LogIcon}
                    text="Notification Log"
                    action={openNotificationLogModal}
                />
                <QuickAction
                    Icon={PaintbrushIcon}
                    text="Edit QuickCSS"
                    action={() => VencordNative.quickCss.openEditor()}
                />
                {!IS_WEB && (
                    <QuickAction
                        Icon={RestartIcon}
                        text="Relaunch Discord"
                        action={relaunch}
                    />
                )}
                {!IS_WEB && (
                    <QuickAction
                        Icon={FolderIcon}
                        text="Open Settings Folder"
                        action={() => VencordNative.settings.openFolder()}
                    />
                )}
                <QuickAction
                    Icon={GithubIcon}
                    text="View Source Code"
                    action={() =>
                        VencordNative.native.openExternal(
                            "https://github.com/" + gitRemote,
                        )
                    }
                />
            </QuickActionCard>

            <Divider className={Margins.top20} />

            <Heading className={Margins.top20}>Client Settings</Heading>
            <Paragraph className={Margins.bottom16}>
                Configure how Starcord behaves and integrates with Discord. These settings affect the Discord client's appearance and behavior.
            </Paragraph>
            <Notice.Info className={Margins.bottom20} style={{ width: "100%" }}>
                You can customize where this settings section appears in Discord's settings menu by configuring the{" "}
                <a
                    role="button"
                    onClick={() => openPluginModal(SettingsPlugin)}
                    style={{ cursor: "pointer", color: "var(--text-link)" }}
                >
                    Settings Plugin
                </a>.
            </Notice.Info>

            <Switches />

            <MacOSVibrancySettings />
            <WindowsMaterialSettings />

            <NotificationSection />
        </SettingsTab >
    );
}

export default wrapTab(StarcordSettings, "Starcord Settings");

export function isStarcordDonor(userId: string): boolean {
    const donorBadges = BadgeAPI.getStarcordDonorBadges(userId);
    return GuildMemberStore.getMember(GUILD_ID, userId)?.roles.includes(DONOR_ROLE_ID) || !!donorBadges;
}

export function isVencordDonor(userId: string): boolean {
    const donorBadges = BadgeAPI.getDonorBadges(userId);
    return GuildMemberStore.getMember(VC_GUILD_ID, userId)?.roles.includes(VC_DONOR_ROLE_ID) || !!donorBadges;
}
