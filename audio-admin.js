(() => {
  "use strict";

  const form = document.querySelector("#generatorForm");
  const keyInput = document.querySelector("#adminKey");
  const nextButton = document.querySelector("#generateNext");
  const allButton = document.querySelector("#generateAll");
  const status = document.querySelector("#adminStatus");
  let running = false;

  function setBusy(value) {
    running = value;
    nextButton.disabled = value;
    allButton.disabled = value;
    keyInput.disabled = value;
  }

  function show(message, state = "working") {
    status.textContent = message;
    status.dataset.state = state;
  }

  async function generateNext() {
    const adminKey = keyInput.value.trim();
    if (!adminKey) throw new Error("Enter the Hebrew audio admin key.");

    const response = await fetch("/api/hebrew-audio", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hebrew-admin-key": adminKey,
      },
      body: JSON.stringify({
        operation: "generate-next",
        verseReference: "Genesis 1:14",
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `Generation request failed (${response.status}).`);
    return body;
  }

  async function runOne() {
    if (running) return;
    setBusy(true);
    show("Generating one section…");
    try {
      const result = await generateNext();
      if (result.ready || result.remaining === 0) {
        show("Genesis 1:14 is fully generated and ready. ✅", "success");
      } else {
        show(`Generated: ${result.segmentLabel || "one section"}\n${result.remaining} section${result.remaining === 1 ? "" : "s"} remaining.`, "success");
      }
    } catch (error) {
      show(error.message || "Generation failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function runAll() {
    if (running) return;
    setBusy(true);
    const completed = [];
    try {
      for (let requestNumber = 1; requestNumber <= 20; requestNumber += 1) {
        show(`Generating section ${requestNumber}…\nCompleted this run: ${completed.length}`);
        const result = await generateNext();
        if (result.segmentLabel) completed.push(result.segmentLabel);
        if (result.ready || result.remaining === 0) {
          show(`Genesis 1:14 is fully generated and ready. ✅\nCompleted this run: ${completed.length}`, "success");
          return;
        }
      }
      throw new Error("Stopped after 20 safe requests. Refresh the track status before continuing.");
    } catch (error) {
      show(`${error.message || "Generation failed."}\nCompleted before the error: ${completed.length}`, "error");
    } finally {
      setBusy(false);
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    runOne();
  });
  allButton.addEventListener("click", runAll);
  window.addEventListener("pagehide", () => { keyInput.value = ""; });
})();
