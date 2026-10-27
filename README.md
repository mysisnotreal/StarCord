# <img src="./browser/icon.png" width="40" align="left" alt="Starcord"> Starcord

Starcord is a fork of [Equicord](https://github.com/Equicord/Equicord), which is itself a fork of [Vencord](https://github.com/Vendicated/Vencord), with over 300+ plugins.

You can join our [Discord server](https://discord.gg/DdYg5CrkXz) for updates, chatting, or support.

### Included Plugins

Starcord ships every plugin from Equicord and Vencord. Plugins originating from Vencord live in `src/plugins`, plugins from Equicord live in `src/equicordplugins`, and plugins made for Starcord live in `src/starcordplugins`.

## Installing Starcord

Starcord does not have prebuilt releases yet, so it is installed by building it from source.

### Dependencies

[Git](https://git-scm.com/download) and [Node.JS LTS](https://nodejs.dev/en/) are required.

Install `pnpm`:

> :exclamation: This next command may need to be run as admin/root depending on your system, and you may need to close and reopen your terminal for pnpm to be in your PATH.

```shell
npm i -g pnpm
```

> :exclamation: **IMPORTANT** Make sure you aren't using an admin/root terminal from here onwards. It **will** mess up your Discord/Starcord instance and you **will** most likely have to reinstall.

Clone Starcord (replace the URL with wherever your Starcord repository is hosted):

```shell
git clone <your-starcord-repository-url> Starcord
cd Starcord
```

Install dependencies:

```shell
pnpm install --frozen-lockfile
```

Build Starcord:

```shell
pnpm build
```

Inject Starcord into your desktop client:

```shell
pnpm inject
```

`pnpm inject` downloads Equicord's installer ([Equilotl](https://github.com/Equicord/Equilotl)) and points it at your local Starcord build. Use `pnpm uninject` to remove it again.

Build Starcord for web:

```shell
pnpm buildWeb
```

After building Starcord's web extension, locate the appropriate ZIP file in the `dist` directory and follow your browser’s guide for installing custom extensions, if supported.

Note: Firefox extension zip requires Firefox for developers

## Updating

Starcord has no built in updater. To update, pull the latest changes and rebuild with `pnpm build`.

To pull in upstream changes:

```shell
git fetch upstream
git merge upstream/main
```

## Credits

Starcord is built on [Equicord](https://github.com/Equicord/Equicord) and all of its contributors.

Thank you to [Vendicated](https://github.com/Vendicated) for creating [Vencord](https://github.com/Vendicated/Vencord) & [Suncord](https://github.com/verticalsync/Suncord) by [verticalsync](https://github.com/verticalsync) for helping Equicord when needed.

## Disclaimer

Discord is trademark of Discord Inc., and solely mentioned for the sake of descriptivity.
Mentioning it does not imply any affiliation with or endorsement by Discord Inc.
Vencord and Equicord are not connected to Starcord and as such, all donation links go to their respective donation links.

<details>
<summary>Using Starcord violates Discord's terms of service</summary>

Client modifications are against Discord’s Terms of Service.

However, Discord is pretty indifferent about them and there are no known cases of users getting banned for using client mods! So you should generally be fine if you don’t use plugins that implement abusive behaviour. But no worries, all inbuilt plugins are safe to use!

Regardless, if your account is essential to you and getting disabled would be a disaster for you, you should probably not use any client mods (not exclusive to Starcord), just to be safe.

Additionally, make sure not to post screenshots with Starcord in a server where you might get banned for it.

</details>
