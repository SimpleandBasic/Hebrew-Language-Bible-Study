(() => {
  'use strict';

  const button = document.querySelector('#generateNextVerseButton');
  const status = document.querySelector('#manualGenerateStatus');
  if (!button || !status) return;

  function setState(message, state = 'idle') {
    status.textContent = message;
    status.dataset.state = state;
  }

  button.addEventListener('click', async () => {
    const confirmed = window.confirm('Generate and publish the next canonical Hebrew verse lesson now? This creates the written lesson and all Cedar audio sections.');
    if (!confirmed) return;

    button.disabled = true;
    button.textContent = 'Generating…';
    setState('Creating the next lesson, generating Cedar audio, and verifying publication. Keep this page open.', 'working');

    try {
      const response = await fetch('/api/generate-next-verse', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok) throw new Error(body.error || `Generation failed (${response.status}).`);

      const minutes = Math.floor((Number(body.total_duration_seconds) || 0) / 60);
      const seconds = Math.round((Number(body.total_duration_seconds) || 0) % 60);
      setState(`${body.reference} is ready: ${body.segment_count} sections, ${minutes}:${String(seconds).padStart(2, '0')}. Refreshing the library…`, 'ready');
      window.setTimeout(() => window.location.reload(), 1200);
    } catch (error) {
      console.error('Manual verse generation failed.', error);
      setState(error.message || 'The next verse could not be generated.', 'error');
      button.disabled = false;
      button.textContent = 'Generate Next Verse';
    }
  });
})();
