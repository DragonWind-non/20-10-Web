# Six-scene environment artwork

The image files listed below live in `public/assets/backgrounds/`.

Created for this project on 2026-10-19 with the built-in `image_gen` tool.
The original 1536 × 1024 PNGs were encoded as JPEG at quality 90 for delivery;
the complete six-image set is approximately 2.3 MB. No external image service
is needed at runtime.

The images contain scenery only. Robots, weather, controls and text are
rendered independently so they remain interactive and responsive.

Shared generation direction: a cinematic landscape background for a romantic
Vietnamese 20 October interactive 3D greeting; premium hand-painted anime
environment art, atmospheric perspective, volumetric light, natural painterly
textures, restrained harmonious color, a calm central sky with room for the
robots and HTML story, landscape horizon low in the frame, details at the
side edges and bottom. No characters, robots, text, logos, borders or UI.

| Asset | Scene prompt |
|---|---|
| `cosmos.jpg` | Quiet midnight-indigo space, silver-blue nebula, a thin crescent, delicate galactic dust arc, sparse stars and a pale planetary horizon; no neon clouds or oversized stars. |
| `spring.jpg` | A spring-dawn lakeside garden, rose and lavender sky, peach horizon, natural cherry blossoms framing the edges, misty mountains, reflected light and a mossy shore. |
| `summer.jpg` | An expansive cerulean summer sky, towering sunlit cumulus at the edges, turquoise lake, soft green hills, a foreground meadow and subtle glowing pollen. |
| `autumn.jpg` | A tranquil autumn lake at sunset, fine crimson and gold maple branches at the edges, amber grasses, layered violet mountains, plum sky and an apricot horizon. |
| `winter.jpg` | A comforting snowy blue-hour lake, a distant warm-windowed chalet, snow-covered firs, mountains, teal aurora and silver moonlight; center kept open. |
| `finale.jpg` | A starlit lakeside valley with a refined silver-blue Milky Way, mountain silhouettes, reflected stars, emerald-blue foreground grass and a few distant warm lanterns; dark space on the left for wishes. |

EVE geometry was redrawn in code using the character photograph on
[Pixar's WALL-E page](https://www.pixar.com/wall-e) as visual reference.
That photograph is not included in the website assets. The glass styling is
a CSS interpretation of the [Liquid Glass design principles](https://developer.apple.com/videos/play/wwdc2025/219/), rather than a native iOS material.

## Photographs used by the cinematic moon finale

The finale additionally uses six locally stored image maps (about 4.1 MiB
combined), acquired on 2026-10-19. They are separate from the six generated
paintings above. None requires an external request at runtime.

- `milky-way-eso.jpg`: [The Milky Way panorama](https://www.eso.org/public/images/eso0932a/),
  credit **ESO/S. Brunier**, delivered at 2560 × 1280, JPEG quality 88 (~809 KiB).
  Original 6000 × 3000 download:
  https://cdn.eso.org/images/large/eso0932a.jpg.
  [CC BY 4.0 and ESO usage terms](https://www.eso.org/public/outreach/copyright/).
  The displayed frame is rotated and cropped to cover the viewport; the
  source is resized and JPEG-compressed locally, with no additional color grade.
  The visible finale credit links to the source.
- `earth-blue-marble.jpg`: [NASA Earth Observatory, Blue Marble: Next Generation,
  Base Map](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/),
  January 2004 composite, 2048 × 1024. Download:
  https://assets.science.nasa.gov/dynamicimage/assets/science/esd/eo/images/bmng/bmng-base/january/world.200401.3x5400x2700.jpg?w=2048&h=1024&fit=clip.
  Texture credit: NASA Earth Observatory; Reto Stöckli. The renderer adds
  directional day/night shading, blue ocean grading and atmospheric rim light.
- `earth-clouds.jpg`: NASA Blue Marble cloud composite, 2048 × 1024;
  credit NASA Goddard Space Flight Center / Reto Stöckli. Context and credits:
  [NASA's Blue Marble imagery](https://science.nasa.gov/earth/earth-observatory/the-blue-marble-true-color-global-imagery-at-1km-resolution/).
  Downloaded from the [Penn State educational mirror](https://phys23p.sl.psu.edu/phys_anim/astro/parallax/cloud_combined_2048.jpg)
  because the historical NASA `cloud_combined_2048.jpg` endpoint is unavailable.
  This is a historical composite, not live weather; cloud coverage, soft cloud
  shadows and a slow relative drift are rendered independently of the land map.
- `moon-regolith-color.jpg`, `moon-regolith-normal.jpg`,
  `moon-regolith-roughness.jpg`: [Poly Haven Moon 01](https://polyhaven.com/a/moon_01),
  1K JPEG diffuse, OpenGL normal and roughness maps, **CC0**. Downloads:
  `https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/moon_01/moon_01_{diff,nor_gl,rough}_1k.jpg`.
  These are scans of **simulated lunar regolith**, not photographs of the lunar
  surface: [capture project and license](https://blog.polyhaven.com/moon/).
  The maps are tiled on the heightfield and small instanced stones, with
  directional shadows and restrained night lighting. Failed loads retain the
  procedural grain texture and geometry.

The four new surface maps total approximately 3.1 MiB. The higher-resolution
Milky Way adds about 657 KiB over the earlier screen-sized copy. All assets
are served locally; no new external service or dependency is used at runtime.

The user's David/Lucy video was inspected locally for camera/composition
reference. Its footage, characters and audio are not included in the site.
