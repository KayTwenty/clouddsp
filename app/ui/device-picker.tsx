"use client";

import { useState } from "react";
import { Check, Disc3, ListMusic, MonitorSpeaker, Music4 } from "lucide-react";
import { DEVICE_GROUPS, findDevice, type Device } from "@/lib/devices";
import DeviceArtwork from "./device-art";

const GROUP_ICONS = { pioneer: Disc3, denon: Music4, studio: MonitorSpeaker } as const;

export default function DevicePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (device: Device) => void;
}) {
  const selectedGroup = DEVICE_GROUPS.find((g) => g.devices.some((d) => d.id === value));
  const [groupId, setGroupId] = useState(selectedGroup?.id ?? DEVICE_GROUPS[0].id);
  const group = DEVICE_GROUPS.find((g) => g.id === groupId) ?? DEVICE_GROUPS[0];
  const selected = findDevice(value);

  return (
    <div>
      <div role="tablist" aria-label="Device brand" className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface-2 p-1">
        {DEVICE_GROUPS.map((g) => {
          const Icon = GROUP_ICONS[g.id as keyof typeof GROUP_ICONS] ?? Disc3;
          const active = g.id === groupId;
          return (
            <button
              key={g.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setGroupId(g.id)}
              className={`flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"
              }`}
            >
              <Icon className="size-4" aria-hidden />
              {g.brand}
            </button>
          );
        })}
      </div>

      <div
        role="radiogroup"
        aria-label={`${group.brand} devices`}
        className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
      >
        {group.devices.map((d) => {
          const isSelected = d.id === value;
          return (
            <button
              key={d.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onChange(d)}
              className={`group relative flex flex-col items-center rounded-xl border p-3 text-center transition-colors ${
                isSelected
                  ? "border-accent bg-accent/10"
                  : "border-border bg-surface-2 hover:border-muted"
              }`}
            >
              {isSelected && (
                <Check className="absolute right-2.5 top-2.5 size-4 text-accent" aria-hidden />
              )}
              {d.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={d.image} alt="" className="h-20 w-full object-contain" />
              ) : (
                <DeviceArtwork
                  art={d.art}
                  className="h-20 w-full transition-transform group-hover:scale-105"
                />
              )}
              <span className="mt-2 text-sm font-semibold">{d.name}</span>
              <span className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                {d.output === "mod" ? (
                  <>
                    <Check className="size-3 text-accent" aria-hidden />
                    Native stems
                  </>
                ) : (
                  <>
                    <ListMusic className="size-3 text-accent-2" aria-hidden />
                    Stem tracks
                  </>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="mt-3 flex gap-3 rounded-xl border border-border bg-surface-2 p-4">
          {selected.output === "mod" ? (
            <Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
          ) : (
            <ListMusic className="mt-0.5 size-4 shrink-0 text-accent-2" aria-hidden />
          )}
          <div className="text-sm">
            <p className="font-medium">
              {selected.name}:{" "}
              {selected.output === "mod" ? "native stems on the deck" : "stems as separate tracks"}
            </p>
            <p className="mt-1 text-muted">{selected.note}</p>
            {selected.output === "tracks" && (
              <p className="mt-1 text-muted">
                You get vocals, drums, bass, other and an instrumental for each track.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
