import type { MetadataRoute } from "next";
import { appManifest } from "@/core/pwa/manifest";

// Served to anyone, signed out, so it never carries the phone spike's key: /dev/mic links its own manifest
// from /api/dev/manifest, which checks k itself.
export default function manifest(): MetadataRoute.Manifest {
  return appManifest({ id: "/", startUrl: "/home" });
}
