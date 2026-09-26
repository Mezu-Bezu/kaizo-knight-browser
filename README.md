# Kaizo Knight Browser

Normal and Weird Route Kaizo Roaring Knight v2.3.3 battles, running entirely in a browser. Choose a route and start directly at the Knight. Includes a route menu, restart button, keyboard controls, fullscreen, and a fight-result overlay.

The arena patch preserves the mod's attack scripts. It changes chapter entry, save selection, arena setup, and the post-battle flow. No native game process runs while playing.

## Play locally

The prepared local edition includes the game inputs. With Node.js installed:

```sh
npm start
```

Open http://127.0.0.1:4173/ in a desktop browser. Arrow keys move/select; Z/Enter confirms; X/Shift cancels or slows; C opens the menu; R restarts; Escape returns to route selection.

## Build from source

The GitHub source edition excludes DELTARUNE game data, audio, saves, and the proprietary GameMaker runtime. Supply your installed Kaizo Knight v2.3.3 game, your normal save, a Weird Route save, and UndertaleModTool CLI v0.9.2.0.

```sh
node scripts/build.mjs --game "C:/Games/DELTARUNE" --normal "C:/path/filech3_1" --weird "C:/path/weird-filech3_1" --utmt "C:/Tools/UndertaleModCli.exe" --runtime "C:/path/browser-runtime"
npm start
```

`--runtime` must contain `runner.js`, `runner.wasm`, and `audio-worklet.js` compatible with the Chapter 3 bytecode. The tested runtime is from [technonyte00/deltarune, chapter3](https://github.com/technonyte00/deltarune/tree/main/chapter3). The builder repacks `runner.data` from your local files and splits game data into files below 25 MiB. No source game files or original saves are modified.

## Save provenance

Normal mode uses the supplied normal checkpoint. The prepared edition uses the user's Chapter 3 slot 2.

Weird mode uses the save shared in [this community request](https://www.reddit.com/r/Deltarune/comments/1tz3r85/need_help_obtaining_a_file/) ([download page](https://www.mediafire.com/file/xhjmdrvzsp0sggu/filech3_1/file)). Its flag 456 is 1, flag 915 is 20, flag 916 is 0, plot is 320, and room is 30108. For this 3,055-line save, flags begin at zero-based line index 552. These are checked against the installed mod's loader; the Knight reads flag 456 as `k_sideb`.

Weird Route uses Kris, Susie, and Noelle. Its 13 battle-item slots match the Normal Route save, while its route flags and character equipment are preserved. The two saves have different equipment and HP. The arena restores each party member to that save's maximum HP when starting an attempt. The original mod's damage, attacks, and route logic are retained.

## Credits

- DELTARUNE: Toby Fox and the DELTARUNE team.
- Kaizo Roaring Knight: EnderCat8.
- Web runtime reference: technonyte00 / truffled / gn-math.
- Game-data tooling: UnderminersTeam / UndertaleModTool.
- Knight-only experience reference: [DEVICE_KNIGHT](https://shadowcrystal.dev/DEVICE_KNIGHT/).

This is an unofficial fan project. Third-party game assets, mod assets, and engine components retain their respective ownership. The new interface and patch do not grant redistribution rights to those components.

## Validation

Verified browser startup for both route saves, route-specific Knight activation, original combat loading, audio download, and direct arena entry. Full Kaizo clears and every late-phase attack have not been playtested.
