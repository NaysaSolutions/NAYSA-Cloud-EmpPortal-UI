let faceioLoaderPromise = null;

function getFaceIOCtor() {
  if (typeof window === "undefined") return null;

  if (typeof window.faceIO === "function") return window.faceIO;
  if (typeof globalThis !== "undefined" && typeof globalThis.faceIO === "function") {
    return globalThis.faceIO;
  }

  if (typeof faceIO === "function") {
    return faceIO;
  }

  return null;
}

export function loadFaceIO() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("FACEIO can only run in the browser."));
  }

  const existingCtor = getFaceIOCtor();
  if (existingCtor) {
    return Promise.resolve(existingCtor);
  }

  if (faceioLoaderPromise) {
    return faceioLoaderPromise;
  }

  faceioLoaderPromise = new Promise((resolve, reject) => {
    const SCRIPT_SRC = "https://cdn.faceio.net/fio.js";

    // ✅ inject script if not exists
    let script = document.querySelector(`script[src="${SCRIPT_SRC}"]`);

    if (!script) {
      script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      document.body.appendChild(script);
    }

    const timeoutMs = 20000;
    const startedAt = Date.now();

    const check = () => {
      const ctor = getFaceIOCtor();

      if (ctor) {
        resolve(ctor);
        return;
      }

      if (Date.now() - startedAt >= timeoutMs) {
        console.error("FACEIO debug", {
          hasScriptTag: !!document.querySelector(`script[src="${SCRIPT_SRC}"]`),
          modalExists: !!document.getElementById("faceio-modal"),
          windowFaceIOType: typeof window.faceIO,
          readyState: document.readyState,
        });

        faceioLoaderPromise = null;
        reject(
          new Error(
            "FACEIO constructor not available. Script may be blocked or failed to load."
          )
        );
        return;
      }

      setTimeout(check, 100);
    };

    // wait for script load first
    script.onload = check;
    script.onerror = () => {
      faceioLoaderPromise = null;
      reject(new Error("Failed to load FACEIO script."));
    };

    // fallback in case already loaded
    check();
  });

  return faceioLoaderPromise;
}