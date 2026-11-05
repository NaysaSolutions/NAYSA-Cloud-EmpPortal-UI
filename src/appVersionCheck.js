import { APP_BUILD_ID } from "./deploymentInfo";

export const checkForNewAppVersion = async () => {
  if (import.meta.env.DEV || !APP_BUILD_ID) return;

  try {
    const response = await fetch(`/version.json?t=${Date.now()}`, {
      cache: "no-store",
    });

    if (!response.ok) return;

    const latestVersion = await response.json();
    const latestBuildId = latestVersion?.buildId;

    if (typeof latestBuildId !== "string" || !latestBuildId.trim() || latestBuildId === APP_BUILD_ID) return;

    // Timestamp build IDs can be ordered. An older manifest must not
    // reload an app that is already newer than the manifest.
    if (
      /^\d{17}$/.test(latestBuildId) &&
      /^\d{17}$/.test(APP_BUILD_ID) &&
      latestBuildId < APP_BUILD_ID
    ) return;

    const currentUrl = new URL(window.location.href);
    const reloadKey = `app-version-reload:${APP_BUILD_ID}`;

    // A cached app bundle may survive a reload. Do not keep reloading it
    // when the deployment manifest and the served assets disagree.
    if (
      currentUrl.searchParams.get("v") === latestBuildId ||
      window.sessionStorage.getItem(reloadKey)
    ) return;

    // Record the attempt before navigating, including overlapping checks.
    // If storage is unavailable, the catch below leaves the app usable.
    window.sessionStorage.setItem(reloadKey, latestBuildId);
    currentUrl.searchParams.set("v", latestBuildId);
    window.location.replace(currentUrl.toString());
  } catch (error) {
    console.warn("Unable to check app version:", error);
  }
};
