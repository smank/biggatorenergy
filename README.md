# Big Gator Energy

A persistent pixel art swamp simulator. Alligators live, hunt, breed, and die
in a seeded ecosystem. Seasons pass, weather rolls through, UFOs abduct,
tornados rip up trees, and the vegetation slowly matures across five epochs.

Live: **https://biggatorenergy.com**

## Stack

- Plain HTML / CSS / JavaScript (ES modules) — no build step
- HTML5 Canvas at 256x144 logical pixels, CSS-scaled with `image-rendering: pixelated`
- Seeded PRNG (mulberry32) drives the simulation — same seed produces the same world
- Web Audio API for procedurally generated ambient audio
- `localStorage` persistence with fast-forward: close the tab, come back later,
  time has passed in the swamp

## Run locally

No dependencies. Serve the repo root over HTTP (`file://` won't work because
the app uses ES modules):

```sh
python3 -m http.server 8080
# open http://localhost:8080
```

## Project layout

```
index.html
style.css
js/
  main.js                 # entry point, game loop, persistence wiring
  config.js               # canvas size, timing, water line, colors
  rng.js                  # seeded PRNG
  ecs.js                  # tiny entity-component-system
  audio.js                # procedural Web Audio (crickets, frogs, drone, etc.)
  input.js                # pointer/keyboard + god-mode power selection
  state.js                # localStorage save/load + elapsed-time fast-forward
  utils/
    math.js               # distance, clamp, lerp
    colors.js             # hex/rgb/hsl conversion, blending, mutation
  systems/
    ai.js                 # gator state machine
    breeding.js           # courtship, mating, nesting, trait inheritance
    lifecycle.js          # aging and natural death
    physics.js            # movement, gravity, water/land detection
    predator.js           # herons that hunt hatchlings
    environment.js        # day/night, seasons, weather, celestial bodies
    events.js             # lightning, UFOs, tornados, eclipses, etc.
    render.js             # all canvas drawing
  game/
    wildlife.js           # non-gator creatures + food chain
    particles.js          # ripples, death, ambient, tracks
    fire.js               # spreading fires
  sprites/
    gator-sprites.js      # gator pixel data, all life stages
    fauna-sprites.js      # prey and predator sprites
    environment-sprites.js
```

## Deploy

GitHub Actions (`.github/workflows/deploy.yml`) fires on push to `main`,
SSH's into the VPS, `git pull`s, rebuilds the Docker image, and restarts
the container. About 10 seconds end to end.

The container is a pinned `nginx:1.27-alpine` serving the static files.
`nginx.conf` sets security headers, gzip, and per-asset cache headers
(short TTL on JS/CSS, `no-cache` on `index.html`).

## URL seeds

`https://biggatorenergy.com/#seed=yourseed` pins the simulation to a
specific seed — same terrain, same starting gators, same story until
the user interacts. Sharing a link shares the world.

## License

Source here is personal — contact the author before reusing.
