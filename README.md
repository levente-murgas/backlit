# Backlit

A small local app for controlling a USB RGBIC monitor backlight strip without the vendor software. It runs a tiny Node.js server on your machine and serves a web UI styled after Apple's Liquid Glass. There is also a command-line tool for scripting.

The USB protocol was recovered from the vendor's DX Light app (Robobloq controller, USB VID `0x1A86` / PID `0xFE07`), so no vendor software needs to be installed or running.

## Features

- **Solid colour** with a colour picker, applied to the whole strip.
- **Brightness** from 0 to 100 %. Changes apply immediately, including to a solid colour or a running effect.
- **Effects**
  - **Rainbow** and **Carousel**: built-in firmware animations. Carousel has a speed slider, from slow (turtle) to fast (bunny).
  - **Smart pulse**: fades in and out through a list of colours you choose, with a configurable number of seconds per pulse. Pulses can be much slower than the firmware effects allow.
  - **Color cycle**: sweeps smoothly through every hue on the colour wheel. You set how many seconds a full cycle takes (120 by default).
  - Changes to effect settings apply straight away to the running effect.
- **Turn off** the strip from the header.
- **Light and dark theme**, dark by default. The choice is remembered in the browser.
- **Stop app** button with a confirmation dialog, which shuts down the local server.
- **Liquid Glass UI**: refracting glass panels over a backdrop that glows in the colour you pick. Real refraction in Chromium-based browsers, frosted glass elsewhere. Reduce Transparency, Increase Contrast and Reduce Motion are respected.
- **Local only**: the server listens on `127.0.0.1` and only accepts JSON requests, so other websites cannot drive the strip.

## How to run the app

Requirements: [Node.js](https://nodejs.org) 18 or newer, and the LED strip plugged in over USB. Developed and tested on macOS.

```sh
git clone https://github.com/levente-murgas/backlit.git
cd backlit
npm install
npm start
```

Then open <http://localhost:4321>. To use another port, start it with `PORT=8080 npm start`.

Close the vendor DX Light app before starting: the strip can only be controlled by one program at a time.

To stop the app, use the **Stop app** button in the header, or press `Ctrl-C` in the terminal.

### Command line

`dxlight.js` can also be used directly without the web UI:

```sh
node dxlight.js color ff4400          # solid colour
node dxlight.js brightness 128        # 5-255
node dxlight.js effect 2 50           # firmware effect 2 (Carousel), speed 50 (higher = slower)
node dxlight.js pulse ff0000,0000ff 20  # software pulse, 20 s per colour, runs until Ctrl-C
node dxlight.js cycle 120             # colour cycle, 120 s per full turn, runs until Ctrl-C
node dxlight.js off
```

Run `node dxlight.js` without arguments for the full usage text, and `npm test` to run the tests.

## Raycast integration

`backlit.sh` is a [Raycast script command](https://github.com/raycast/script-commands). Typing `backlit` in Raycast starts the app if it is not already running and opens it in your default browser. If the app is already running, it just opens the page; it never starts a second copy.

To set it up:

1. In Raycast, open **Settings > Extensions > Script Commands > Add Directories**.
2. Add the folder that contains `backlit.sh`. Either add the cloned `backlit` folder itself, or symlink the script into a folder you already use for script commands:

   ```sh
   ln -s "$PWD/backlit.sh" ~/path/to/your/raycast-scripts/backlit.sh
   ```

The script finds the app next to itself, also through a symlink. Raycast does not load `nvm`, so if `node` is not on Raycast's `PATH` the script falls back to the newest Node.js version installed with `nvm`. Server output is written to `/tmp/backlit.log`.

## What RGB LED strip is needed

Backlit was built for this kit from LEDstrips.dk:

[PC Sync LED strip 24" skaerm 3 sider - RGBIC, USB, 60 LED/m](https://ledstrips.dk/31729-pc-sync-led-strip-24-skaerm-3-sider-rgbic-usb-60-led-m-5740031816434.html)

- RGBIC, 60 LEDs per metre
- Three strips (25 cm + 35 cm + 25 cm) for three sides of a roughly 24" monitor
- Powered and controlled over a single USB connection (5 V, 10 W)
- The same listing is also available for 27", 32" and 34" monitors

What matters is the USB controller rather than the strip itself. Backlit talks to controllers that show up as USB VID `0x1A86` / PID `0xFE07` (Robobloq, used by the DX Light app). Other strips with the same controller should work too; strips with a different controller will not be detected.

To check whether your strip's controller matches, run this with the strip plugged in after `npm install`:

```sh
node -e "console.log(require('node-hid').devices().filter(d => d.vendorId === 0x1a86 && d.productId === 0xfe07))"
```

An empty list means the controller is not supported.

## Credits

The Liquid Glass styling uses [liquid-glass-skill](https://github.com/asimov-academy/liquid-glass-skill) by Asimov Academy (MIT), vendored as `liquid-glass.css` and `liquid-glass.js`.
