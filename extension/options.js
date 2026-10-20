/* Extension options page. Plain JavaScript, external file to satisfy MV3 CSP. */
(function () {
  'use strict';

  var form = document.getElementById('options-form');
  var status = document.getElementById('status');
  var hostedInput = document.getElementById('hosted-url');
  var testButton = document.getElementById('test-url');

  function setStatus(message, isError) {
    status.textContent = message;
    status.classList.toggle('error', Boolean(isError));
  }

  function selectedMode() {
    var checked = form.querySelector('input[name="mode"]:checked');
    return checked ? checked.value : 'bundled';
  }

  function normaliseHostedUrl(value) {
    var trimmed = String(value || '').trim();
    if (!trimmed) return null;
    try {
      var url = new URL(trimmed);
      if (url.protocol !== 'https:') {
        var isLocal =
          url.protocol === 'http:' &&
          (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
        if (!isLocal) return null;
      }
      return url.toString();
    } catch (error) {
      return null;
    }
  }

  function load() {
    chrome.storage.local.get(['mode', 'hostedUrl'], function (values) {
      var mode = values.mode === 'hosted' ? 'hosted' : 'bundled';
      var radio = form.querySelector('input[name="mode"][value="' + mode + '"]');
      if (radio) radio.checked = true;
      hostedInput.value =
        typeof values.hostedUrl === 'string' && values.hostedUrl ? values.hostedUrl : '';
    });
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var mode = selectedMode();
    var hostedUrl = normaliseHostedUrl(hostedInput.value);

    if (mode === 'hosted' && !hostedUrl) {
      setStatus(
        'Enter a valid https:// address, or http://localhost for local development.',
        true,
      );
      hostedInput.focus();
      return;
    }

    chrome.storage.local.set(
      {
        mode: mode,
        hostedUrl: hostedUrl || hostedInput.value.trim(),
      },
      function () {
        if (chrome.runtime.lastError) {
          setStatus('Could not save settings: ' + chrome.runtime.lastError.message, true);
          return;
        }
        setStatus(
          mode === 'hosted'
            ? 'Saved. New tabs will redirect to the hosted homepage.'
            : 'Saved. New tabs will open the bundled homepage.',
          false,
        );
      },
    );
  });

  testButton.addEventListener('click', function () {
    var url = normaliseHostedUrl(hostedInput.value);
    if (!url) {
      setStatus('Enter a valid hosted URL first.', true);
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  });

  load();
})();
