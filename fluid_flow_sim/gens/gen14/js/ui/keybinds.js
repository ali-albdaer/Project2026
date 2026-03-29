import { KEYBINDS } from "../config.js";

export function installKeybinds(state, panel, actions) {
  window.addEventListener("keydown", (ev) => {
    const tag = document.activeElement?.tagName || "";
    const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

    if (ev.code === KEYBINDS.togglePause) {
      ev.preventDefault();
      state.paused = !state.paused;
      return;
    }

    if (typing) {
      return;
    }

    if (ev.code === KEYBINDS.togglePanel) {
      panel.togglePanel();
      return;
    }

    if (ev.code === KEYBINDS.toggleProbe) {
      state.visual.showProbe = !state.visual.showProbe;
      panel.el.probeEnabled.checked = state.visual.showProbe;
      return;
    }

    if (ev.code === KEYBINDS.toggleLayers) {
      const next = !(state.visual.showDelta || state.visual.showDeltaStar || state.visual.showTheta);
      state.visual.showDelta = next;
      state.visual.showDeltaStar = next;
      state.visual.showTheta = next;
      panel.el.showDelta.checked = next;
      panel.el.showDeltaStar.checked = next;
      panel.el.showTheta.checked = next;
      return;
    }

    if (ev.code === KEYBINDS.spawnArmed) {
      state.spawnArmed = !state.spawnArmed;
      panel.el.spawnArmed.checked = state.spawnArmed;
      return;
    }

    if (ev.code === KEYBINDS.reset) {
      actions.reset();
    }
  });
}
