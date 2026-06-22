import { APP_BUILD_ID } from "./deploymentInfo";

export const checkForNewAppVersion = async () => {
  if (import.meta.env.DEV) return;

  try {
    const response = await fetch(`/version.json?t=${Date.now()}`, {
      cache: "no-store",
    });

    if (!response.ok) return;

    const latestVersion = await response.json();
    const latestBuildId = latestVersion?.buildId;

    if (!latestBuildId || latestBuildId === APP_BUILD_ID) return;

    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set("v", latestBuildId);
    window.location.replace(currentUrl.toString());
  } catch (error) {
    console.warn("Unable to check app version:", error);
  }
};
