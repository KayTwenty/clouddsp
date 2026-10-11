// "mod": stems written in the format a community firmware mod plays natively.
// "tracks": each stem exported as its own playable track, which works on any
// deck, DAW or DJ software. Used where no open stem format exists.
export type Output = "mod" | "tracks";

// Native stem formats the worker knows how to write.
export type ModFormat = "cdj3k";

// Audio format for "tracks" output.
export const FORMATS = ["wav", "flac", "mp3"] as const;
export type AudioFormat = (typeof FORMATS)[number];

// Which drawing to show for a device. See app/ui/device-art.tsx.
export type DeviceArt =
  | "player-touch"
  | "player"
  | "all-in-one"
  | "all-in-one-4"
  | "all-in-one-compact"
  | "daw"
  | "dj-software";

export type Device = {
  id: string;
  name: string;
  output: Output;
  modFormat?: ModFormat;
  note: string;
  art: DeviceArt;
  // Optional real product image (transparent PNG/WebP in /public/devices).
  // Only add images you have the rights to use.
  image?: string;
  defaultFormat?: AudioFormat;
};

export type DeviceGroup = { id: string; brand: string; devices: Device[] };

const ENGINE_NOTE =
  "Engine DJ stems use a closed format, so stems come as separate tracks to import with Engine DJ.";
const NO_MOD_NOTE = "No stem mod yet, so stems come as separate playable tracks.";

const denon = (name: string, art: DeviceArt): Device => ({
  id: name.toLowerCase().replace(/\+/g, "-plus").replace(/\s+/g, "-"),
  name,
  output: "tracks",
  note: ENGINE_NOTE,
  art,
});

export const DEVICE_GROUPS: DeviceGroup[] = [
  {
    id: "pioneer",
    brand: "Pioneer DJ / AlphaTheta",
    devices: [
      {
        id: "cdj-3000",
        name: "CDJ-3000",
        output: "mod",
        modFormat: "cdj3k",
        note: "Native stems with cdj3k-mods, firmware 3.13 to 3.22. Drums, harmonics and vocals on the deck.",
        art: "player-touch",
      },
      { id: "cdj-3000x", name: "CDJ-3000X", output: "tracks", note: NO_MOD_NOTE, art: "player-touch" },
      { id: "cdj-2000nxs2", name: "CDJ-2000NXS2", output: "tracks", note: NO_MOD_NOTE, art: "player" },
      { id: "cdj-2000nxs", name: "CDJ-2000NXS", output: "tracks", note: NO_MOD_NOTE, art: "player" },
      { id: "cdj-2000", name: "CDJ-2000", output: "tracks", note: NO_MOD_NOTE, art: "player" },
      {
        id: "xdj-xz",
        name: "XDJ-XZ",
        output: "tracks",
        note: "Stems come as separate tracks for now. Native XZ Mods support is coming soon.",
        art: "all-in-one-4",
      },
      {
        id: "xdj-az",
        name: "XDJ-AZ",
        output: "tracks",
        note: "Stems come as separate tracks for now. Native AZ-MODS support is coming soon.",
        art: "all-in-one-4",
      },
      {
        id: "xdj-rx3",
        name: "XDJ-RX3",
        output: "tracks",
        note: "Stems come as separate tracks for now. Native MOLE support is coming soon.",
        art: "all-in-one",
      },
    ],
  },
  {
    id: "denon",
    brand: "Denon DJ",
    devices: [
      denon("SC6000", "player-touch"),
      denon("SC6000M", "player-touch"),
      denon("SC5000", "player-touch"),
      denon("SC5000M", "player-touch"),
      denon("Prime 4+", "all-in-one-4"),
      denon("Prime 4", "all-in-one-4"),
      denon("SC Live 4", "all-in-one-4"),
      denon("Prime 2", "all-in-one"),
      denon("SC Live 2", "all-in-one"),
      denon("Prime Go+", "all-in-one-compact"),
      denon("Prime Go", "all-in-one-compact"),
    ],
  },
  {
    id: "studio",
    brand: "Studio & software",
    devices: [
      {
        id: "daw",
        name: "DAW",
        output: "tracks",
        note: "Separate stems for Ableton Live, FL Studio, Logic Pro, Bitwig, Reaper and any other DAW. Every stem lines up sample for sample.",
        art: "daw",
        defaultFormat: "wav",
      },
      {
        id: "dj-software",
        name: "DJ software",
        output: "tracks",
        note: "Stem tracks for rekordbox, Serato DJ, Traktor, VirtualDJ and Engine DJ Desktop.",
        art: "dj-software",
      },
    ],
  },
];

export const ALL_DEVICES = DEVICE_GROUPS.flatMap((g) => g.devices);

export function findDevice(id: string) {
  return ALL_DEVICES.find((d) => d.id === id);
}

export const PRESET_IDS = ["fast", "balanced", "quality"] as const;
export type PresetId = (typeof PRESET_IDS)[number];

export const ACCEPTED_EXTENSIONS = [".mp3", ".wav", ".flac", ".aiff", ".aif", ".m4a"];
export const MAX_FILE_BYTES = 200 * 1024 * 1024;

export function isAudio(name: string) {
  const lower = name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

// Stems shown in the live visualizer and the preview player.
export const STEMS = ["drums", "bass", "other", "vocals"] as const;
export type StemId = (typeof STEMS)[number];
export const LIVE_BUCKETS = 400;
