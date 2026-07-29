(() => {
  'use strict';

  const button = document.querySelector('#generateNextVerseButton');
  const status = document.querySelector('#manualGenerateStatus');
  const copy = document.querySelector('.manual-generate-copy p:last-child');
  if (!button || !status) return;

  if (copy) {
    copy.textContent = 'Builds the next premium sermon, every Cedar audio section, the six-card visual study, artwork relationships, and the atomic release.';
  }

  function setState(message, state = 'idle') {
    status.textContent = message;
    status.dataset.state = state;
  }

  button.addEventListener('click', async () => {
    const confirmed = window.confirm('Generate and publish the next complete Hebrew Bible episode now? This creates the sermon, Cedar audio, visual study, artwork relationships, and verified release.');
    if (!confirmed) return;

    button.disabled = true;
    button.textContent = 'Building Episode…';
    setState('Researching the verse, writing the sermon, generating Cedar audio, building visuals, and verifying one complete release. Keep this page open.', 'working');

    try {
      const response = await fetch('/api/run-generation-job?action=start_manual', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'start_manual' }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok) throw new Error(body.error || `Generation failed (${response.status}).`);

      const result = body.result || body;
      const minutes = Math.floor((Number(result.total_duration_seconds) || 0) / 60);
      const seconds = Math.round((Number(result.total_duration_seconds) || 0) % 60);
      const visualCount = Number(result.visual_card_count) || 0;
      setState(`${result.reference} is fully published: ${result.segment_count} audio sections, ${visualCount} visual cards, ${minutes}:${String(seconds).padStart(2, '0')}. Refreshing the library…`, 'ready');
      window.setTimeout(() => window.location.reload(), 1200);
    } catch (error) {
      console.error('Manual V4 episode generation failed.', error);
      setState(error.message || 'The next complete episode could not be generated.', 'error');
      button.disabled = false;
      button.textContent = 'Generate Next Verse';
    }
  });
})();
