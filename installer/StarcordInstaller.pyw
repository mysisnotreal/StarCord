#!/usr/bin/env python3
# Starcord Installer
# SPDX-License-Identifier: GPL-3.0-or-later
#
# Patches Discord to load Starcord the same way the official installer does:
# resources/app.asar is renamed to _app.asar and replaced by a tiny asar archive whose
# index.js requires Starcord. Run from the repository it uses the local build (dist/desktop).
# Packaged as an executable it carries its own build and copies it to Starcord's data folder.

from __future__ import annotations

import json
import os
import platform
import re
import shutil
import struct
import subprocess
import sys
from pathlib import Path

SYSTEM = platform.system()
FROZEN = getattr(sys, "frozen", False)
ROOT = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
ICON_PATH = ROOT / "image.png"


def starcord_data_dir() -> Path:
    """Same folder Starcord keeps its settings in, next to Discord's own data folder."""
    if SYSTEM == "Windows":
        return Path(os.environ.get("APPDATA", Path.home() / "AppData" / "Roaming")) / "Starcord"
    if SYSTEM == "Darwin":
        return Path.home() / "Library" / "Application Support" / "Starcord"
    return Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config")) / "Starcord"


BUNDLED_BUILD = ROOT / "starcord"
STARCORD_DIR = starcord_data_dir() / "dist" if FROZEN else ROOT.parent / "dist" / "desktop"

COLORS = {
    "bg": "#0d0d0d",
    "panel": "#161616",
    "border": "#262626",
    "fg": "#ffffff",
    "muted": "#a1a1a1",
    "accent": "#f5b82e",
    "accent_hover": "#ffc94d",
    "accent_fg": "#0d0d0d",
    "success": "#3ba55d",
    "warning": "#f0b232",
    "danger": "#ed4245",
}


# asar handling

def build_stub_asar(target: Path) -> bytes:
    """Builds the same minimal asar archive the official installer writes."""
    index_js = f"require({json.dumps(str(target))})".encode()
    package_json = b'{\n\t"name": "discord",\n\t"main": "index.js"\n}'

    header = json.dumps({
        "files": {
            "index.js": {"size": len(index_js), "offset": "0"},
            "package.json": {"size": len(package_json), "offset": str(len(index_js))},
        }
    }, separators=(",", ":")).encode()

    padding = (4 - len(header) % 4) % 4
    payload_size = 4 + len(header) + padding
    prefix = struct.pack("<IIII", 4, payload_size + 4, payload_size, len(header))
    return prefix + header + b"\0" * padding + index_js + package_json


def read_stub_index(app_asar: Path) -> str | None:
    """Returns the index.js of a patcher stub, which is either a small asar archive or a folder."""
    try:
        if app_asar.is_dir():
            return (app_asar / "index.js").read_text("utf-8")

        if app_asar.stat().st_size > 64 * 1024:
            return None

        data = app_asar.read_bytes()
        _, header_size, _, json_size = struct.unpack_from("<IIII", data)
        header = json.loads(data[16:16 + json_size])
        entry = header["files"]["index.js"]
        start = 8 + header_size + int(entry["offset"])
        return data[start:start + entry["size"]].decode("utf-8")
    except (OSError, ValueError, KeyError, struct.error):
        return None


def get_status(resources: Path) -> tuple[str, str]:
    """Returns (state, description). state is one of starcord, other, unpatched, invalid."""
    app_asar = resources / "app.asar"
    original = resources / "_app.asar"

    if not original.exists():
        if app_asar.is_file():
            return "unpatched", "Not patched"
        return "invalid", "This folder doesn't look like a Discord installation"

    index = read_stub_index(app_asar) if app_asar.exists() else None
    match = re.search(r'require\((".*?")\)', index or "")
    if not match:
        return "other", "Patched by an unknown client mod"

    target = Path(json.loads(match.group(1)))
    try:
        if target.resolve() in (STARCORD_DIR.resolve(), (STARCORD_DIR / "patcher.js").resolve()):
            return "starcord", "Patched with Starcord"
    except OSError:
        pass

    lowered = str(target).lower()
    for name in ("Starcord", "Equicord", "Vencord", "Suncord"):
        if name.lower() in lowered:
            return "other", f"Patched with {name} ({target})"
    return "other", f"Patched with another client mod ({target})"


def install_bundled_build() -> None:
    """The executable unpacks into a temporary folder, so Discord has to load a permanent copy."""
    if STARCORD_DIR.exists():
        shutil.rmtree(STARCORD_DIR)
    shutil.copytree(BUNDLED_BUILD, STARCORD_DIR)


def is_build_available() -> bool:
    return ((BUNDLED_BUILD if FROZEN else STARCORD_DIR) / "patcher.js").exists()


def flatpak_app_id(resources: Path) -> str | None:
    match = re.search(r"com\.discordapp\.\w+", str(resources))
    return match.group(0) if match else None


def allow_flatpak_access(resources: Path, target: Path) -> None:
    """Flatpak Discord is sandboxed and can't read Starcord's folder unless it is allowed to."""
    app_id = flatpak_app_id(resources)
    if not app_id or not shutil.which("flatpak"):
        return

    command = ["flatpak", "override", "--user", f"--filesystem={target}:ro", app_id]
    if subprocess.run(command, capture_output=True).returncode != 0:
        raise RuntimeError(f"Couldn't give the Discord Flatpak access to Starcord. Run this command, then try again:\n{' '.join(command)}")


def patch(resources: Path, target: Path = STARCORD_DIR) -> None:
    app_asar = resources / "app.asar"
    original = resources / "_app.asar"

    if not original.exists():
        if not app_asar.is_file():
            raise RuntimeError("Couldn't find Discord's app.asar in this folder.")
        app_asar.rename(original)
    elif app_asar.is_dir():
        shutil.rmtree(app_asar)

    try:
        app_asar.write_bytes(build_stub_asar(target))
    except OSError:
        if not app_asar.exists():
            original.rename(app_asar)
        raise


def unpatch(resources: Path) -> None:
    app_asar = resources / "app.asar"
    original = resources / "_app.asar"

    if not original.exists():
        raise RuntimeError("This Discord installation isn't patched.")

    if app_asar.is_dir():
        shutil.rmtree(app_asar)
    elif app_asar.exists():
        app_asar.unlink()
    original.rename(app_asar)


# Discord detection

def latest_app_dir(base: Path) -> Path | None:
    """Discord's updater keeps versions in app-x.y.z folders. Picks the newest one with resources."""
    def version(p: Path):
        return tuple(int(n) if n.isdigit() else 0 for n in p.name[4:].split("."))

    try:
        candidates = [p for p in base.glob("app-*") if (p / "resources").is_dir()]
    except OSError:
        return None
    return max(candidates, key=version) / "resources" if candidates else None


def find_discord_installs() -> list[tuple[str, Path]]:
    home = Path.home()
    channels = [("Discord", "discord"), ("Discord PTB", "discordptb"), ("Discord Canary", "discordcanary")]
    found: list[tuple[str, Path]] = []

    def add(name: str, resources: Path | None):
        if not resources:
            return
        if ((resources / "app.asar").exists() or (resources / "_app.asar").exists()) \
                and all(resources != p for _, p in found):
            found.append((name, resources))

    if SYSTEM == "Windows":
        local = Path(os.environ.get("LOCALAPPDATA", home / "AppData" / "Local"))
        for name, folder in [("Discord", "Discord"), ("Discord PTB", "DiscordPTB"),
                             ("Discord Canary", "DiscordCanary"), ("Discord Development", "DiscordDevelopment")]:
            add(name, latest_app_dir(local / folder))

    elif SYSTEM == "Darwin":
        for apps in (Path("/Applications"), home / "Applications"):
            for name in ("Discord", "Discord PTB", "Discord Canary"):
                add(name, apps / f"{name}.app" / "Contents" / "Resources")

    else:
        config = Path(os.environ.get("XDG_CONFIG_HOME", home / ".config"))
        flatpak_config = home / ".var" / "app" / "com.discordapp.Discord" / "config"
        for name, folder in channels:
            add(name, latest_app_dir(config / folder))
            add(f"{name} (Flatpak)", latest_app_dir(flatpak_config / folder))

        for name, folder in channels:
            short = folder.replace("discord", "discord-") if folder != "discord" else folder
            for base in (Path("/opt"), Path("/usr/share"), Path("/usr/lib"), Path("/usr/lib64"), home / ".local" / "share"):
                for candidate in {folder, short, name.replace(" ", "")}:
                    add(name, base / candidate / "resources")

        for base in (Path("/var/lib/flatpak"), home / ".local" / "share" / "flatpak"):
            add("Discord (Flatpak)", base / "app" / "com.discordapp.Discord" / "current" / "active" / "files" / "discord" / "resources")

    return found


def resolve_resources(folder: Path) -> Path | None:
    """Accepts a resources folder, a Discord install folder or a Discord.app bundle."""
    for candidate in (folder, folder / "resources", folder / "Contents" / "Resources"):
        if (candidate / "app.asar").exists() or (candidate / "_app.asar").exists():
            return candidate
    return latest_app_dir(folder)


def is_discord_running() -> bool:
    try:
        if SYSTEM == "Windows":
            out = subprocess.run(["tasklist"], capture_output=True, text=True, creationflags=0x08000000).stdout
            return bool(re.search(r"^discord(ptb|canary|development)?\.exe", out, re.I | re.M))
        out = subprocess.run(["ps", "-A", "-o", "comm="], capture_output=True, text=True).stdout
        return bool(re.search(r"^discord(ptb|canary)?$", out, re.I | re.M))
    except OSError:
        return False


# CLI, used to retry with elevated permissions

def prepare_patch(resources: Path) -> None:
    """Steps that have to run as the current user, before Discord's files are touched."""
    if FROZEN:
        install_bundled_build()
    if SYSTEM == "Linux":
        allow_flatpak_access(resources, STARCORD_DIR)


def run_cli(args: list[str]) -> int:
    action, path = args[0], Path(args[1])
    target = Path(args[2]) if len(args) > 2 else None
    try:
        if action == "--unpatch":
            unpatch(path)
        elif target:
            patch(path, target)
        else:
            prepare_patch(path)
            patch(path)
    except (OSError, RuntimeError) as err:
        print(err, file=sys.stderr)
        return 1
    return 0


# GUI

def run_gui() -> None:
    import tkinter as tk
    from tkinter import filedialog, messagebox, ttk

    root = tk.Tk()
    root.title("Starcord Installer")
    root.configure(bg=COLORS["bg"])
    root.geometry("620x420")
    root.minsize(560, 400)

    icon = None
    if ICON_PATH.exists():
        try:
            icon = tk.PhotoImage(file=str(ICON_PATH))
            root.iconphoto(True, icon)
        except tk.TclError:
            icon = None

    style = ttk.Style(root)
    style.theme_use("clam")
    style.configure("Starcord.TCombobox", fieldbackground=COLORS["panel"], background=COLORS["panel"],
                    foreground=COLORS["fg"], arrowcolor=COLORS["accent"], bordercolor=COLORS["border"],
                    lightcolor=COLORS["panel"], darkcolor=COLORS["panel"], padding=6)
    style.map("Starcord.TCombobox", fieldbackground=[("readonly", COLORS["panel"])],
              foreground=[("readonly", COLORS["fg"])], selectbackground=[("readonly", COLORS["panel"])],
              selectforeground=[("readonly", COLORS["fg"])])
    root.option_add("*TCombobox*Listbox.background", COLORS["panel"])
    root.option_add("*TCombobox*Listbox.foreground", COLORS["fg"])
    root.option_add("*TCombobox*Listbox.selectBackground", COLORS["accent"])
    root.option_add("*TCombobox*Listbox.selectForeground", COLORS["accent_fg"])

    font = "Segoe UI" if SYSTEM == "Windows" else "Helvetica"

    def make_button(parent, text, command, primary=False):
        bg = COLORS["accent"] if primary else COLORS["panel"]
        fg = COLORS["accent_fg"] if primary else COLORS["fg"]
        hover = COLORS["accent_hover"] if primary else COLORS["border"]
        button = tk.Button(parent, text=text, command=command, bg=bg, fg=fg, activebackground=hover,
                           activeforeground=fg, relief="flat", bd=0, padx=18, pady=8, cursor="hand2",
                           font=(font, 11, "bold"), highlightthickness=0, disabledforeground=COLORS["muted"])
        button.bind("<Enter>", lambda _: button["state"] != "disabled" and button.configure(bg=hover))
        button.bind("<Leave>", lambda _: button.configure(bg=bg))
        return button

    container = tk.Frame(root, bg=COLORS["bg"], padx=24, pady=20)
    container.pack(fill="both", expand=True)

    header = tk.Frame(container, bg=COLORS["bg"])
    header.pack(fill="x")
    if icon:
        logo = icon.zoom(3)
        tk.Label(header, image=logo, bg=COLORS["bg"]).pack(side="left", padx=(0, 14))
        header.logo = logo
    titles = tk.Frame(header, bg=COLORS["bg"])
    titles.pack(side="left")
    tk.Label(titles, text="Starcord Installer", bg=COLORS["bg"], fg=COLORS["fg"],
             font=(font, 20, "bold")).pack(anchor="w")
    tk.Label(titles, text="Patch Discord to load your local Starcord build", bg=COLORS["bg"],
             fg=COLORS["muted"], font=(font, 10)).pack(anchor="w")

    tk.Label(container, text="DISCORD INSTALLATION", bg=COLORS["bg"], fg=COLORS["muted"],
             font=(font, 9, "bold")).pack(anchor="w", pady=(22, 6))

    picker = tk.Frame(container, bg=COLORS["bg"])
    picker.pack(fill="x")
    selection = tk.StringVar()
    combo = ttk.Combobox(picker, textvariable=selection, state="readonly", style="Starcord.TCombobox",
                         font=(font, 10))
    combo.pack(side="left", fill="x", expand=True)

    status_card = tk.Frame(container, bg=COLORS["panel"], highlightbackground=COLORS["border"],
                           highlightthickness=1, padx=16, pady=14)
    status_card.pack(fill="x", pady=(16, 0))
    status_dot = tk.Label(status_card, text="●", bg=COLORS["panel"], font=(font, 14))
    status_dot.pack(side="left", padx=(0, 10))
    status_text = tk.Frame(status_card, bg=COLORS["panel"])
    status_text.pack(side="left", fill="x", expand=True)
    status_label = tk.Label(status_text, bg=COLORS["panel"], fg=COLORS["fg"], font=(font, 12, "bold"),
                            anchor="w", justify="left")
    status_label.pack(fill="x")
    path_label = tk.Label(status_text, bg=COLORS["panel"], fg=COLORS["muted"], font=(font, 9),
                          anchor="w", justify="left", wraplength=480)
    path_label.pack(fill="x")

    build_label = tk.Label(container, bg=COLORS["bg"], font=(font, 9), anchor="w", justify="left",
                           wraplength=560)
    build_label.pack(fill="x", pady=(12, 0))

    actions = tk.Frame(container, bg=COLORS["bg"])
    actions.pack(fill="x", side="bottom")

    installs: list[tuple[str, Path]] = []

    def current() -> Path | None:
        index = combo.current()
        return installs[index][1] if 0 <= index < len(installs) else None

    def refresh_status(*_):
        built = is_build_available()
        build_label.configure(
            text=(f"Starcord installs to: {STARCORD_DIR}" if FROZEN else f"Starcord build: {STARCORD_DIR}") if built
            else "Starcord isn't built yet. Run pnpm build in the Starcord folder, then click Refresh.",
            fg=COLORS["muted"] if built else COLORS["danger"])

        resources = current()
        if not resources:
            status_dot.configure(fg=COLORS["muted"])
            status_label.configure(text="No Discord installation found")
            path_label.configure(text="Use Browse to select your Discord folder.")
            patch_button.configure(state="disabled")
            unpatch_button.configure(state="disabled")
            return

        state, description = get_status(resources)
        status_dot.configure(fg={"starcord": COLORS["success"], "other": COLORS["warning"],
                                 "unpatched": COLORS["muted"]}.get(state, COLORS["danger"]))
        status_label.configure(text=description)
        path_label.configure(text=str(resources))
        patch_button.configure(text="Repatch" if state == "starcord" else "Patch",
                               state="normal" if built and state != "invalid" else "disabled")
        unpatch_button.configure(state="normal" if state in ("starcord", "other") else "disabled")

    def load_installs(select: Path | None = None):
        installs[:] = find_discord_installs()
        if select and all(select != p for _, p in installs):
            installs.append(("Custom", select))
        combo["values"] = [f"{name}  —  {path}" for name, path in installs]
        if installs:
            paths = [p for _, p in installs]
            combo.current(paths.index(select) if select in paths else 0)
        else:
            selection.set("")
        refresh_status()

    def browse():
        folder = filedialog.askdirectory(title="Select your Discord folder")
        if not folder:
            return
        resources = resolve_resources(Path(folder))
        if not resources:
            messagebox.showerror("Starcord Installer", "Couldn't find Discord's app.asar in that folder.")
            return
        load_installs(resources)

    def run_action(action: str):
        resources = current()
        if not resources:
            return
        try:
            if action == "--patch":
                prepare_patch(resources)
                patch(resources)
            else:
                unpatch(resources)
        except PermissionError:
            if SYSTEM == "Linux" and shutil.which("pkexec") and messagebox.askyesno(
                    "Starcord Installer", "Administrator permissions are needed to modify this Discord "
                                          "installation. Try again with administrator permissions?"):
                command = [sys.executable] if FROZEN else [sys.executable, str(Path(__file__).resolve())]
                extra = [str(STARCORD_DIR)] if action == "--patch" else []
                result = subprocess.run(["pkexec", *command, action, str(resources), *extra],
                                        capture_output=True, text=True)
                if result.returncode != 0:
                    messagebox.showerror("Starcord Installer", result.stderr.strip() or "Failed with administrator permissions.")
                    return refresh_status()
            elif SYSTEM == "Darwin":
                messagebox.showerror("Starcord Installer", "macOS blocked access to Discord. Quit Discord, allow "
                                     "StarCordInstaller under System Settings > Privacy & Security > App Management, "
                                     "then try again.")
                return refresh_status()
            else:
                hint = "run this installer as administrator" if SYSTEM == "Windows" else "run this installer with sudo"
                messagebox.showerror("Starcord Installer", f"Permission denied. Close Discord and {hint}.")
                return refresh_status()
        except (OSError, RuntimeError) as err:
            hint = "\n\nMake sure Discord is fully closed and try again." if SYSTEM == "Windows" else ""
            messagebox.showerror("Starcord Installer", f"{err}{hint}")
            return refresh_status()

        refresh_status()
        done = "Starcord was installed!" if action == "--patch" else "Starcord was removed."
        restart = " Restart Discord to apply the changes." if is_discord_running() else ""
        messagebox.showinfo("Starcord Installer", done + restart)

    patch_button = make_button(actions, "Patch", lambda: run_action("--patch"), primary=True)
    patch_button.pack(side="right")
    unpatch_button = make_button(actions, "Unpatch", lambda: run_action("--unpatch"))
    unpatch_button.pack(side="right", padx=(0, 10))
    make_button(actions, "Refresh", lambda: load_installs(current())).pack(side="left")
    make_button(picker, "Browse", browse).pack(side="left", padx=(10, 0))

    combo.bind("<<ComboboxSelected>>", refresh_status)
    load_installs()
    root.mainloop()


if __name__ == "__main__":
    if len(sys.argv) in (3, 4) and sys.argv[1] in ("--patch", "--unpatch"):
        sys.exit(run_cli(sys.argv[1:]))
    run_gui()
