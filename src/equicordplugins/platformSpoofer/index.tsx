/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { HeaderBarButton } from "@api/HeaderBar";
import { showNotice } from "@api/Notices";
import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { StarcordDevs } from "@utils/constants";
import { relaunch } from "@utils/native";
import definePlugin from "@utils/types";
import { Menu, Popout, useRef, useState } from "@webpack/common";

const Platforms = {
    desktop: { label: "Desktop", browser: "Discord Client" },
    web: { label: "Web", browser: "Discord Web" },
    android: { label: "Android", browser: "Discord Android" },
    ios: { label: "iOS", browser: "Discord iOS" },
    xbox: { label: "Xbox", browser: "Discord Embedded" },
    playstation: { label: "PlayStation", browser: "Discord Embedded" },
    vr: { label: "VR", browser: "Discord VR" },
} as const;
type Platform = keyof typeof Platforms;

const currentDevice: Platform = IS_WEB ? "web" : "desktop";

const settings = definePluginSettings({}).withPrivateSettings<{ platform?: Platform; }>();

const getSelectedPlatform = () => settings.store.platform ?? currentDevice;

let identifiedPlatform: Platform | null = null;
let restartNoticeShown = false;

function setPlatform(platform: Platform) {
    settings.store.platform = platform;

    if (platform === (identifiedPlatform ?? currentDevice) || restartNoticeShown) return;

    restartNoticeShown = true;
    showNotice("Changing your spoofed platform requires a restart.", "Restart", relaunch, "LAUNCH_GAME_FAILURE");
}

function PlatformIcon({ width = 20, height = 20 }: { width?: number; height?: number; }) {
    return (
        <svg viewBox="0 0 24 24" width={width} height={height}>
            <path
                fill="currentColor"
                d="M3 4.5A2.5 2.5 0 0 1 5.5 2h11A2.5 2.5 0 0 1 19 4.5V8h-2V4.5a.5.5 0 0 0-.5-.5h-11a.5.5 0 0 0-.5.5v8a.5.5 0 0 0 .5.5H12v2H9v2h3v2H7a1 1 0 1 1 0-2h.5v-2h-2A2.5 2.5 0 0 1 3 12.5v-8Zm11 6A2.5 2.5 0 0 1 16.5 8h3a2.5 2.5 0 0 1 2.5 2.5v9a2.5 2.5 0 0 1-2.5 2.5h-3a2.5 2.5 0 0 1-2.5-2.5v-9Zm2.5-.5a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5h-3Zm1.5 7.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"
            />
        </svg>
    );
}

function PlatformMenu({ onClose }: { onClose(): void; }) {
    const { platform = currentDevice } = settings.use(["platform"]);

    return (
        <Menu.Menu navId="vc-platform-spoofer" onClose={onClose} aria-label="Platform Spoofer">
            <Menu.MenuGroup label="Spoof Platform">
                {Object.entries(Platforms).map(([id, { label }]) => (
                    <Menu.MenuRadioItem
                        key={id}
                        id={`vc-platform-spoofer-${id}`}
                        group="vc-platform-spoofer"
                        label={id === currentDevice ? `${label} (this device)` : label}
                        checked={platform === id}
                        action={() => setPlatform(id as Platform)}
                    />
                ))}
            </Menu.MenuGroup>
        </Menu.Menu>
    );
}

function PlatformSpooferButton() {
    const buttonRef = useRef(null);
    const [show, setShow] = useState(false);
    const { platform = currentDevice } = settings.use(["platform"]);

    return (
        <Popout
            position="bottom"
            align="center"
            spacing={0}
            animation={Popout.Animation.NONE}
            shouldShow={show}
            onRequestClose={() => setShow(false)}
            targetElementRef={buttonRef}
            renderPopout={() => <PlatformMenu onClose={() => setShow(false)} />}
        >
            {(_, { isShown }) => (
                <HeaderBarButton
                    ref={buttonRef}
                    onClick={() => setShow(v => !v)}
                    tooltip={isShown ? null : `Platform: ${Platforms[platform].label}`}
                    icon={PlatformIcon}
                    selected={isShown}
                />
            )}
        </Popout>
    );
}

const WrappedPlatformSpooferButton = ErrorBoundary.wrap(PlatformSpooferButton, { noop: true });

export default definePlugin({
    name: "PlatformSpoofer",
    description: "Spoof what platform or device you're on, using the button next to the help button in the top right",
    tags: ["Utility"],
    authors: [StarcordDevs.Drag, StarcordDevs.neoarz],
    required: true,
    hidden: true,
    settings,
    patches: [
        {
            find: "_doIdentify(){",
            replacement: [
                {
                    match: /window._ws=null,null!=\i/,
                    replace: "false"
                },
                {
                    match: /(?<="GatewaySocket"\)\}\),properties:)(\i)/,
                    replace: "{...$1,...$self.getPlatform()}"
                },
            ]
        },
        {
            find: '?"BACK_FORWARD_NAVIGATION":',
            replacement: {
                match: /(?=\i\?\(0,\i\.jsx\)\(\i,\{focusSectionProps:"HELP"===)/,
                replace: "$self.renderPlatformButton(),"
            }
        }
    ],

    getPlatform() {
        const platform = getSelectedPlatform();
        identifiedPlatform ??= platform;

        return platform === currentDevice ? null : { browser: Platforms[platform].browser };
    },

    renderPlatformButton() {
        return <WrappedPlatformSpooferButton key="vc-platform-spoofer" />;
    }
});
