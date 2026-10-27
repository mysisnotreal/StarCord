/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { HeaderBarButton } from "@api/HeaderBar";
import { BaseText } from "@components/BaseText";
import { Button } from "@components/Button";
import { Paragraph } from "@components/Paragraph";
import { classNameFactory } from "@utils/css";
import { Popout, TextInput, useRef, useState } from "@webpack/common";

import { getRealNames, refreshNames } from "./names";
import { settings } from "./settings";

const cl = classNameFactory("vc-starcord-users-");
const NAME_KEYS: ["displayName", "username"] = ["displayName", "username"];

function setName(key: "displayName" | "username", value: string) {
    settings.store[key] = key === "username" ? value.replace(/^@+/, "") : value;
    refreshNames();
}

function NameIcon() {
    return (
        <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden="true">
            <path fill="currentColor" d="M4 4a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h16a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H4Zm4.5 4a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM4.5 16.6c.5-1.8 2.1-2.6 4-2.6s3.5.8 4 2.6c.1.4-.2.4-.5.4h-7c-.3 0-.6 0-.5-.4ZM14 9h5a1 1 0 1 1 0 2h-5a1 1 0 1 1 0-2Zm0 4h3a1 1 0 1 1 0 2h-3a1 1 0 1 1 0-2Z" />
        </svg>
    );
}

function NameEditor() {
    const { displayName = "", username = "" } = settings.use(NAME_KEYS);
    const real = getRealNames();

    return (
        <div className={cl("name-editor")}>
            <BaseText tag="h2" size="md" weight="semibold">Your Name</BaseText>
            <Paragraph color="text-muted">Only you see these, nothing is sent to Discord. Leave a box empty to use your real one.</Paragraph>

            <label className={cl("name-field")}>
                <BaseText size="xs" weight="semibold" className={cl("name-label")}>Display Name</BaseText>
                <TextInput
                    value={displayName}
                    onChange={v => setName("displayName", v)}
                    placeholder={real.globalName ?? real.username ?? "Display Name"}
                    maxLength={32}
                    autoFocus
                />
            </label>

            <label className={cl("name-field")}>
                <BaseText size="xs" weight="semibold" className={cl("name-label")}>Username (@)</BaseText>
                <TextInput
                    value={username}
                    onChange={v => setName("username", v)}
                    placeholder={real.username ?? "username"}
                    maxLength={32}
                />
            </label>

            <Button
                variant="secondary"
                size="small"
                disabled={!displayName && !username}
                onClick={() => {
                    setName("displayName", "");
                    setName("username", "");
                }}
            >
                Use My Real Names
            </Button>
        </div>
    );
}

export function NameEditorButton() {
    const buttonRef = useRef(null);
    const [show, setShow] = useState(false);

    return (
        <Popout
            position="bottom"
            align="center"
            spacing={8}
            shouldShow={show}
            onRequestClose={() => setShow(false)}
            targetElementRef={buttonRef}
            renderPopout={() => <NameEditor />}
        >
            {(_, { isShown }) => (
                <HeaderBarButton
                    ref={buttonRef}
                    onClick={() => setShow(v => !v)}
                    tooltip={isShown ? null : "Your Name"}
                    icon={NameIcon}
                    selected={isShown}
                />
            )}
        </Popout>
    );
}
