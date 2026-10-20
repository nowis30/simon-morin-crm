if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })
    .then((registration) => registration.update())
    .catch(() => {
      // The application remains usable if service workers are unavailable.
    });
}
