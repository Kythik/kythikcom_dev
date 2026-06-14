something something bla bjhabka

<iframe class="h-full w-full" title="Rendered HTML content" sandbox="allow-scripts allow-same-origin" allow="clipboard-write" srcdoc="&lt;!DOCTYPE html&gt;
&lt;html lang=&quot;en&quot;&gt;
&lt;head&gt;
    &lt;script src=&quot;https://cdnjs.cloudflare.com/ajax/libs/html-to-image/1.11.13/html-to-image.min.js&quot; integrity=&quot;sha512-iZ2ORl595Wx6miw+GuadDet4WQbdSWS3JLMoNfY8cRGoEFy6oT3G9IbcrBeL6AfkgpA51ETt/faX6yLV+/gFJg==&quot; crossorigin=&quot;anonymous&quot; referrerpolicy=&quot;no-referrer&quot;&gt;&lt;/script&gt;
    &lt;script&gt;
      (function() {
        // Capture host references before any artifact code runs: Window.parent
        // is [Replaceable] (a top-level `var parent` in artifact code would
        // replace the accessor with a data property), and a top-level
        // `const crypto` would shadow the global — either would otherwise
        // silently break the bridge for artifacts that worked before.
        const realParent = window.parent;
        const cryptoObj = window.crypto;
        // crypto.randomUUID exists only in Secure Contexts; fall back to a
        // unique non-crypto id elsewhere (http://LAN-IP dev flows) —
        // uniqueness is what the bridge needs, unpredictability is
        // defense-in-depth on top of the source guards.
        const newRequestId =
          cryptoObj &amp;&amp; typeof cryptoObj.randomUUID === &quot;function&quot;
            ? function () { return cryptoObj.randomUUID(); }
            : function () { return Date.now() + &quot;-&quot; + Math.random(); };
        const originalConsole = window.console;
        window.console = {
          log: (...args) =&gt; {
            originalConsole.log(...args);
            realParent.postMessage({ type: 'console', message: args.join(' ') }, '*');
          },
          error: (...args) =&gt; {
            originalConsole.error(...args);
            realParent.postMessage({ type: 'console', message: 'Error: ' + args.join(' ') }, '*');
          },
          warn: (...args) =&gt; {
            originalConsole.warn(...args);
            realParent.postMessage({ type: 'console', message: 'Warning: ' + args.join(' ') }, '*');
          }
        };

        // Bridge request ids are crypto-random (not sequential) so they
        // cannot be predicted by other frames in the tab.
        let callbacksMap = new Map();
        let streamControllers = new Map();
        
        window.claude = {
          complete: (prompt) =&gt; {
            return new Promise((resolve, reject) =&gt; {
              const id = newRequestId();
              callbacksMap.set(id, { resolve, reject });
              realParent.postMessage({ type: 'claudeComplete', id, prompt }, '*');
            });
          }
        };

        window.storage = {
          get: (key, shared = false) =&gt; {
            return new Promise((resolve, reject) =&gt; {
              const id = newRequestId();
              callbacksMap.set(id, { resolve, reject });
              realParent.postMessage({ type: 'storageGet', id, key, shared }, '*');
            });
          },
          set: (key, value, shared = false) =&gt; {
            return new Promise((resolve, reject) =&gt; {
              const id = newRequestId();
              callbacksMap.set(id, { resolve, reject });
              realParent.postMessage({ type: 'storageSet', id, key, value, shared }, '*');
            });
          },
          delete: (key, shared = false) =&gt; {
            return new Promise((resolve, reject) =&gt; {
              const id = newRequestId();
              callbacksMap.set(id, { resolve, reject });
              realParent.postMessage({ type: 'storageDelete', id, key, shared }, '*');
            });
          },
          list: (prefix, shared = false) =&gt; {
            return new Promise((resolve, reject) =&gt; {
              const id = newRequestId();
              callbacksMap.set(id, { resolve, reject });
              realParent.postMessage({ type: 'storageList', id, prefix, shared }, '*');
            });
          }
        };

        let pendingBlobs = new Map();
        URL.createObjectURL = (blob) =&gt; {
          // Store the blob and create an ID and URL for it
          const blobId = `blob-${Date.now()}-${Math.random()}`;
          pendingBlobs.set(blobId, blob);
          return `blob-request://${blobId}`;
        };

        URL.revokeObjectURL = (url) =&gt; {
          // Remove the blob from our store
          const blobId = url.replace(&quot;blob-request://&quot;, &quot;&quot;);
          pendingBlobs.delete(blobId);
        };

        const getBlobFromURL = (url) =&gt; {
          const blobId = url.replace(&quot;blob-request://&quot;, &quot;&quot;);
          return pendingBlobs.get(blobId);
        };

        // Override global fetch with streaming support
        window.fetch = (url, init = {}) =&gt; {
          return new Promise((resolve, reject) =&gt; {
            const id = newRequestId();
            const channelId = `fetch-${id}-${Date.now()}`;
            
            callbacksMap.set(id, { 
              resolve: (response) =&gt; {
                // Null-body statuses: Response(stream, {status: 204}) throws
                // per the Fetch spec, which would escape this resolver and
                // hang the artifact's await forever.
                if (response.status === 204 || response.status === 205 || response.status === 304) {
                  try {
                    resolve(new Response(null, {
                      status: response.status,
                      statusText: response.statusText,
                      headers: response.headers
                    }));
                  } catch (err) {
                    // Invalid statusText/header bytes can throw here too.
                    reject(new TypeError(
                      'Bridge fetch: unconstructable response (status ' + response.status + ')'
                    ));
                  }
                  return;
                }
                // Create a ReadableStream for the response body
                const stream = new ReadableStream({
                  start(controller) {
                    streamControllers.set(channelId, controller);
                  },
                  cancel() {
                    streamControllers.delete(channelId);
                  }
                });
                
                // Create and return the Response with the stream. Response()
                // requires status in [200, 599]; an opaque/no-cors fetch
                // forwards status 0, which would throw here and escape the
                // resolver, hanging the artifact's await. Surface it as a
                // network-error-shaped rejection instead.
                try {
                  resolve(new Response(stream, {
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers
                  }));
                } catch (err) {
                  streamControllers.delete(channelId);
                  reject(new TypeError(
                    'Bridge fetch: unconstructable response (status ' + response.status + ')'
                  ));
                }
              },
              reject,
              channelId
            });
            
            realParent.postMessage({
              type: 'proxyFetch',
              id,
              url,
              init,
              channelId
            }, '*');
          });
        };

        window.addEventListener('message', async (event) =&gt; {
          // Only the embedding parent may drive the bridge — sibling and
          // nested frames can also postMessage into this window.
          if (event.source !== realParent) return;
          if (event.data.type === 'takeScreenshot') {
            // Echo the request's nonce so the requester can correlate the
            // reply to ITS request — a reply without the expected nonce
            // (e.g. from a stale pre-remount artifact) is ignored upstream.
            const screenshotNonce = event.data.nonce;
            const rootElement = document.getElementById('artifacts-component-root-html');
            if (!rootElement) {
              realParent.postMessage({
                type: 'screenshotError',
                nonce: screenshotNonce,
                error: new Error('Root element not found'),
              }, '*');
              return;
            }
            // Catch CDN load failures (htmlToImage undefined) and toPng errors
            // so the parent always gets a response instead of hanging forever.
            try {
              const screenshot = await htmlToImage.toPng(rootElement, {
                imagePlaceholder:
                  &quot;data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAA1JREFUGFdjePDgwX8ACOQDoNsk0PMAAAAASUVORK5CYII=&quot;,
              });
              realParent.postMessage({
                type: 'screenshotData',
                nonce: screenshotNonce,
                data: screenshot,
              }, '*');
            } catch (err) {
              realParent.postMessage({
                type: 'screenshotError',
                nonce: screenshotNonce,
                error: err instanceof Error ? err : new Error(String(err)),
              }, '*');
            }
          } else if (event.data.type === 'claudeComplete') {
            const callback = callbacksMap.get(event.data.id);
            if (!callback) return;
            if (event.data.error) {
              callback.reject(new Error(event.data.error));
            } else {
              callback.resolve(event.data.completion);
            }
            callbacksMap.delete(event.data.id);
          } else if (event.data.type === 'proxyFetchResponse') {
            const callback = callbacksMap.get(event.data.id);
            if (!callback) return;
            if (event.data.error) {
              callback.reject(new Error(event.data.error));
              callbacksMap.delete(event.data.id);
            } else {
              // Initial response with headers, status, etc.
              callback.resolve({
                status: event.data.status,
                statusText: event.data.statusText,
                headers: event.data.headers
              });
              // Don't delete the callback yet if streaming
              if (!event.data.body) {
                callbacksMap.delete(event.data.id);
              }
            }
          } else if (event.data.type === 'proxyFetchStream') {
            // Handle streaming data chunks
            const controller = streamControllers.get(event.data.channelId);
            if (controller) {
              if (event.data.error) {
                controller.error(new Error(event.data.error));
                streamControllers.delete(event.data.channelId);
              } else if (event.data.done) {
                controller.close();
                streamControllers.delete(event.data.channelId);
                // Clean up the callback
                const callback = Array.from(callbacksMap.entries()).find(
                  ([_, value]) =&gt; value.channelId === event.data.channelId
                );
                if (callback) {
                  callbacksMap.delete(callback[0]);
                }
              } else if (event.data.chunk) {
                controller.enqueue(new Uint8Array(event.data.chunk));
              }
            }
          } else if (event.data.type === 'storageGet') {
            const callback = callbacksMap.get(event.data.id);
            if (!callback) return;
            if (event.data.error) {
              callback.reject(new Error(event.data.error));
            } else {
              callback.resolve(event.data.result);
            }
            callbacksMap.delete(event.data.id);
          } else if (event.data.type === 'storageSet') {
            const callback = callbacksMap.get(event.data.id);
            if (!callback) return;
            if (event.data.error) {
              callback.reject(new Error(event.data.error));
            } else {
              callback.resolve(event.data.result);
            }
            callbacksMap.delete(event.data.id);
          } else if (event.data.type === 'storageDelete') {
            const callback = callbacksMap.get(event.data.id);
            if (!callback) return;
            if (event.data.error) {
              callback.reject(new Error(event.data.error));
            } else {
              callback.resolve(event.data.result);
            }
            callbacksMap.delete(event.data.id);
          } else if (event.data.type === 'storageList') {
            const callback = callbacksMap.get(event.data.id);
            if (!callback) return;
            if (event.data.error) {
              callback.reject(new Error(event.data.error));
            } else {
              callback.resolve(event.data.result);
            }
            callbacksMap.delete(event.data.id);
          }
        });

        window.addEventListener('click', (event) =&gt; {
          const isEl = event.target instanceof HTMLElement;
          if (!isEl) return;
    
          // find ancestor links
          const linkEl = event.target.closest(&quot;a&quot;);
          if (!linkEl || !linkEl.href) return;
    
          event.preventDefault();
          event.stopImmediatePropagation();
    
          if (linkEl.href.startsWith(&quot;blob-request:&quot;)) {
            const blob = getBlobFromURL(linkEl.href);
            if (!blob) return;
            void blob.arrayBuffer().then((data) =&gt; {
              realParent.postMessage({
                type: &quot;downloadFile&quot;,
                filename: linkEl.download,
                data,
                mimeType: blob.type || &quot;application/octet-stream&quot;,
              });
            });
          } else if (linkEl.href.startsWith(&quot;data:&quot;)) {
            const [header, base64Data] = linkEl.href.split(&quot;,&quot;);
            const mimeMatch = header.match(/data:([^;]+)/);
            const mimeType = mimeMatch ? mimeMatch[1] : &quot;application/octet-stream&quot;;
            const binaryString = atob(base64Data);
            const data = Uint8Array.from(binaryString, (c) =&gt;
              c.charCodeAt(0),
            ).buffer;
            realParent.postMessage({
              type: &quot;downloadFile&quot;,
              filename: linkEl.download,
              data,
              mimeType,
            });
          } else {
            let linkUrl;
            try {
              linkUrl = new URL(linkEl.href);
            } catch (error) {
              return;
            }
    
            if (linkUrl.hostname === window.location.hostname) return;
      
            realParent.postMessage({
              type: 'openExternal',
              href: linkEl.href,
            }, '*');
          }
      });

        const originalOpen = window.open;
        window.open = function (url) {
          realParent.postMessage({
            type: &quot;openExternal&quot;,
            href: url,
          }, &quot;*&quot;);
        };

        window.addEventListener('error', (event) =&gt; {
          realParent.postMessage({ type: 'console', message: 'Uncaught Error: ' + event.message }, '*');
        });
      })();
    &lt;/script&gt;
  
&lt;meta charset=&quot;UTF-8&quot;&gt;
&lt;meta name=&quot;viewport&quot; content=&quot;width=device-width, initial-scale=1.0&quot;&gt;
&lt;title&gt;Clockwork Ballet EV Calculator — kythik.com&lt;/title&gt;
&lt;link rel=&quot;stylesheet&quot; href=&quot;/styles.css&quot;&gt;
&lt;link rel=&quot;stylesheet&quot; href=&quot;/shared/header-additions.css&quot;&gt;
&lt;link rel=&quot;stylesheet&quot; href=&quot;/torchlight/clockwork/clockwork_styles.css&quot;&gt;
&lt;link rel=&quot;preconnect&quot; href=&quot;https://fonts.googleapis.com&quot;&gt;
&lt;link href=&quot;https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&amp;family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,700&amp;display=swap&quot; rel=&quot;stylesheet&quot;&gt;
&lt;/head&gt;
&lt;body class=&quot;clockwork-page&quot; id=&quot;artifacts-component-root-html&quot;&gt;

&lt;!-- Background effects matching kythik.com --&gt;
&lt;div class=&quot;page-bg-img&quot;&gt;&lt;/div&gt;
&lt;svg class=&quot;hex-bg&quot; xmlns=&quot;http://www.w3.org/2000/svg&quot; aria-hidden=&quot;true&quot;&gt;
    &lt;defs&gt;
      &lt;pattern id=&quot;hexGrid&quot; width=&quot;50&quot; height=&quot;84&quot; patternUnits=&quot;userSpaceOnUse&quot;&gt;
        &lt;polygon points=&quot;25,0 50,14 50,42 25,56 0,42 0,14&quot;
                 fill=&quot;none&quot; stroke=&quot;#1A3055&quot; stroke-width=&quot;0.8&quot;/&gt;
        &lt;polygon points=&quot;0,42 25,56 25,84 0,98 -25,84 -25,56&quot;
                 fill=&quot;none&quot; stroke=&quot;#1A3055&quot; stroke-width=&quot;0.8&quot;/&gt;
        &lt;polygon points=&quot;50,42 75,56 75,84 50,98 25,84 25,56&quot;
                 fill=&quot;none&quot; stroke=&quot;#1A3055&quot; stroke-width=&quot;0.8&quot;/&gt;
      &lt;/pattern&gt;
    &lt;/defs&gt;
    &lt;rect width=&quot;100%&quot; height=&quot;100%&quot; fill=&quot;url(#hexGrid)&quot;/&gt;
  &lt;/svg&gt;

&lt;div id=&quot;site-header&quot; data-active-game=&quot;torchlight&quot;&gt;&lt;/div&gt;

&lt;header class=&quot;cw-page-head&quot;&gt;
  &lt;div class=&quot;cw-page-head__inner&quot;&gt;
    &lt;div class=&quot;cw-page-head__copy&quot;&gt;
      &lt;span class=&quot;kicker&quot;&gt;Torchlight Infinite — SS12&lt;/span&gt;
      &lt;h1 class=&quot;display display--lg cw-page-title&quot;&gt;Clockwork Ballet&lt;/h1&gt;
      &lt;p class=&quot;subtext cw-page-sub&quot;&gt;Member Service EV rankings, reroll guidance, and setup-aware value checks for deep-space Clockwork runs.&lt;/p&gt;
    &lt;/div&gt;

    &lt;a class=&quot;resource-card cw-cheat-card&quot; href=&quot;cheatsheet.html&quot; target=&quot;_blank&quot; rel=&quot;noopener&quot; aria-label=&quot;Open Clockwork Ballet cheat sheet&quot;&gt;
      &lt;span class=&quot;resource-card__kicker&quot;&gt;Quick Reference&lt;/span&gt;
      &lt;span class=&quot;resource-card__title&quot;&gt;Open Cheat Sheet&lt;/span&gt;
      &lt;span class=&quot;resource-card__body&quot;&gt;Compact pick-order view for mid-run checks.&lt;/span&gt;
    &lt;/a&gt;
  &lt;/div&gt;
&lt;/header&gt;

&lt;div class=&quot;main&quot;&gt;


  &lt;section class=&quot;panel clockwork-setup-panel&quot;&gt;
  &lt;div class=&quot;clockwork-panel-head&quot;&gt;
    &lt;span class=&quot;kicker&quot;&gt;Setup&lt;/span&gt;
    &lt;p&gt;Calibrate the rankings around your doll, probe, Alice tier, and tree nodes.&lt;/p&gt;
  &lt;/div&gt;
  &lt;div class=&quot;ctrls&quot;&gt;

    &lt;div class=&quot;ctrl-group&quot;&gt;
      &lt;label&gt;Collection Doll Astrolabe&lt;/label&gt;
      &lt;select class=&quot;select&quot; id=&quot;doll&quot;&gt;
        &lt;option value=&quot;none&quot;&gt;Doll Astrolabe (base, ~6% est.)&lt;/option&gt;
        &lt;option value=&quot;regular&quot;&gt;Collection Doll (~19% est., unverified)&lt;/option&gt;
        &lt;option value=&quot;artifact&quot; selected&gt;Collection Doll Artifact (~45% observed)&lt;/option&gt;
      &lt;/select&gt;
    &lt;/div&gt;
    &lt;div class=&quot;ctrl-group&quot;&gt;
      &lt;label&gt;Probe&lt;/label&gt;
      &lt;select class=&quot;select&quot; id=&quot;probe&quot;&gt;
        &lt;option value=&quot;none&quot;&gt;None&lt;/option&gt;
        &lt;option value=&quot;compass&quot; selected&gt;Compass Deep Space Probe&lt;/option&gt;
        &lt;option value=&quot;doll&quot;&gt;Doll Deep Space Probe&lt;/option&gt;
      &lt;/select&gt;
    &lt;/div&gt;

    &lt;div class=&quot;ctrl-group&quot;&gt;
      &lt;label&gt;Alice tier&lt;/label&gt;
      &lt;select class=&quot;select&quot; id=&quot;alice&quot;&gt;
        &lt;option value=&quot;none&quot;&gt;None&lt;/option&gt;
        &lt;option value=&quot;lv1&quot;&gt;Lv1 (25% double)&lt;/option&gt;
        &lt;option value=&quot;lv23&quot;&gt;Lv2-3 (25% double + 8% proc)&lt;/option&gt;
        &lt;option value=&quot;lv45&quot;&gt;Lv4-5 (25% double + 16% proc)&lt;/option&gt;
        &lt;option value=&quot;lv6&quot;&gt;Lv6 (33.25% double + 16% proc)&lt;/option&gt;
      &lt;/select&gt;
    &lt;/div&gt;

    &lt;div class=&quot;ctrl-group&quot;&gt;
      &lt;label&gt;Sort by&lt;/label&gt;
      &lt;select class=&quot;select&quot; id=&quot;sort&quot; onchange=&quot;render()&quot;&gt;
        &lt;option value=&quot;ev&quot;&gt;EV added&lt;/option&gt;
        &lt;option value=&quot;rarity&quot;&gt;Rarity&lt;/option&gt;
        &lt;option value=&quot;tier&quot;&gt;Tier&lt;/option&gt;
      &lt;/select&gt;
    &lt;/div&gt;

  &lt;/div&gt;

  &lt;div class=&quot;panel--inset clockwork-node-panel&quot;&gt;
    &lt;span class=&quot;kicker&quot;&gt;Clockwork Tree Nodes&lt;/span&gt;
    &lt;div class=&quot;node-grid&quot;&gt;

      &lt;label class=&quot;chk-row&quot;&gt;
        &lt;input type=&quot;checkbox&quot; id=&quot;node-indulgent&quot; onchange=&quot;render()&quot;&gt;
        &lt;span class=&quot;tip&quot;&gt;
          &lt;span class=&quot;chk-label-text&quot;&gt;Booster Drink Proc&lt;/span&gt;
          &lt;span class=&quot;tip-icon&quot;&gt;?&lt;/span&gt;
          &lt;span class=&quot;tip-text&quot;&gt;Clockwork tree (Indulgent): 24% chance for a Runaway Dancer when touching a Booster Drink. Requires +1 Booster Drink node — assumes both allocated. Always Gold voucher.&lt;/span&gt;
        &lt;/span&gt;
      &lt;/label&gt;

      &lt;label class=&quot;chk-row&quot;&gt;
        &lt;input type=&quot;checkbox&quot; id=&quot;node-vain&quot; onchange=&quot;render()&quot;&gt;
        &lt;span class=&quot;tip&quot;&gt;
          &lt;span class=&quot;chk-label-text&quot;&gt;Time Extender Proc&lt;/span&gt;
          &lt;span class=&quot;tip-icon&quot;&gt;?&lt;/span&gt;
          &lt;span class=&quot;tip-text&quot;&gt;Clockwork tree (Vain): 8% chance for a Runaway Dancer when touching a Time Extender. Requires +1 Time Extender node — assumes both allocated. Always Gold voucher.&lt;/span&gt;
        &lt;/span&gt;
      &lt;/label&gt;

      &lt;label class=&quot;chk-row&quot;&gt;
        &lt;input type=&quot;checkbox&quot; id=&quot;node-wasteful&quot; onchange=&quot;onWastefulClick()&quot;&gt;
        &lt;span class=&quot;tip&quot;&gt;
          &lt;span class=&quot;chk-label-text&quot;&gt;Sub-60s Podium&lt;/span&gt;
          &lt;span class=&quot;tip-icon&quot;&gt;?&lt;/span&gt;
          &lt;span class=&quot;tip-text&quot;&gt;Clockwork tree (Wasteful branch): 10% chance Orange+ voucher + 100% +30% Drop Quantity at podium when less than 60s remaining. Mutually exclusive with Over-60s Podium. ID15 +10s bonus can interfere with this threshold.&lt;/span&gt;
        &lt;/span&gt;
      &lt;/label&gt;

      &lt;label class=&quot;chk-row&quot;&gt;
        &lt;input type=&quot;checkbox&quot; id=&quot;node-ostentatious&quot; onchange=&quot;onOstentatiousClick()&quot;&gt;
        &lt;span class=&quot;tip&quot;&gt;
          &lt;span class=&quot;chk-label-text&quot;&gt;Over-60s Podium&lt;/span&gt;
          &lt;span class=&quot;tip-icon&quot;&gt;?&lt;/span&gt;
          &lt;span class=&quot;tip-text&quot;&gt;Clockwork tree (Ostentatious branch): 3% chance Orange+ voucher + 100% +10% Drop Quantity at podium when more than 60s remaining. Mutually exclusive with Sub-60s Podium.&lt;/span&gt;
        &lt;/span&gt;
      &lt;/label&gt;

      &lt;label class=&quot;chk-row&quot;&gt;
        &lt;input type=&quot;checkbox&quot; id=&quot;node-cb59&quot; onchange=&quot;render()&quot;&gt;
        &lt;span class=&quot;tip&quot;&gt;
          &lt;span class=&quot;chk-label-text&quot;&gt;Podium Bonus Voucher&lt;/span&gt;
          &lt;span class=&quot;tip-icon&quot;&gt;?&lt;/span&gt;
          &lt;span class=&quot;tip-text&quot;&gt;Clockwork tree (cb_59): 13% chance for 1 additional Cogwheel Voucher at podium turnin. Does NOT fire on Roulette fail (event ends before podium) or ID23 early end (safe cashout bypasses podium). Only fires on normal full-run turnin.&lt;/span&gt;
        &lt;/span&gt;
      &lt;/label&gt;


      &lt;label class=&quot;chk-row&quot;&gt;
        &lt;input type=&quot;checkbox&quot; id=&quot;node-seasonal&quot; onchange=&quot;render()&quot;&gt;
        &lt;span class=&quot;tip&quot;&gt;
          &lt;span class=&quot;chk-label-text&quot;&gt;In-Map Season Mechanic&lt;/span&gt;
          &lt;span class=&quot;tip-icon&quot;&gt;?&lt;/span&gt;
          &lt;span class=&quot;tip-text&quot;&gt;Some seasons add an in-map mechanic that scales with rating effects and rewards. Lunaria (S12) has one. When active, SSS-reaching services like ID11 gain extra value — ID11 hits SSS mid-run before turnin, maximizing season scaling. Not all seasons have an in-map mechanic.&lt;/span&gt;
        &lt;/span&gt;
      &lt;/label&gt;

    &lt;/div&gt;
    &lt;div class=&quot;node-exclusive-note&quot; id=&quot;exclusive-note&quot; style=&quot;display:none&quot;&gt;⚠ Sub-60s and Over-60s Podium are mutually exclusive — only one can be active.&lt;/div&gt;
  &lt;/div&gt;
  &lt;/section&gt;&lt;!-- /clockwork-setup-panel --&gt;

&lt;div id=&quot;reroll-decision-panel&quot; class=&quot;reroll-panel&quot;&gt;
  &lt;div class=&quot;reroll-panel-title&quot;&gt;
    &lt;span&gt;Reroll Decision&lt;/span&gt;
    &lt;div style=&quot;display:flex;align-items:center;gap:10px&quot;&gt;
      &lt;span class=&quot;reroll-alice-note&quot; id=&quot;reroll-alice-note&quot;&gt;&lt;/span&gt;
      &lt;button class=&quot;link-button&quot; onclick=&quot;showLightbox()&quot;&gt;how this works ↗&lt;/button&gt;
    &lt;/div&gt;
  &lt;/div&gt;
  &lt;div id=&quot;reroll-has-rerolls&quot; style=&quot;display:none&quot;&gt;
    &lt;div class=&quot;reroll-verdict v-keep&quot; id=&quot;reroll-verdict&quot;&gt;
      &lt;div&gt;
        &lt;div class=&quot;verdict-label&quot; id=&quot;verdict-label&quot;&gt;&lt;/div&gt;
        &lt;div class=&quot;verdict-sub&quot; id=&quot;verdict-sub&quot;&gt;&lt;/div&gt;
      &lt;/div&gt;
      &lt;div class=&quot;verdict-icon&quot; id=&quot;verdict-icon&quot;&gt;&lt;/div&gt;
    &lt;/div&gt;
  &lt;/div&gt;
&lt;/div&gt;

&lt;div class=&quot;svc-list-wrap&quot;&gt;
    &lt;div class=&quot;svc-list&quot; id=&quot;tbody&quot;&gt;&lt;/div&gt;
  &lt;div id=&quot;roul-footnote&quot; class=&quot;clockwork-footnote&quot;&gt;&lt;/div&gt;
&lt;/div&gt;&lt;!-- /svc-list-wrap --&gt;

&lt;/div&gt;


&lt;!-- ID10 Lightbox --&gt;
&lt;div id=&quot;id10-lightbox&quot; class=&quot;overlay&quot; style=&quot;display:none;align-items:center;justify-content:center&quot;&gt;
  &lt;div onclick=&quot;event.stopPropagation()&quot; class=&quot;overlay-panel&quot; style=&quot;max-width:520px;width:100%;max-height:85vh;overflow-y:auto&quot;&gt;
    &lt;button onclick=&quot;document.getElementById('id10-lightbox').style.display='none';document.body.style.overflow='';&quot; class=&quot;overlay-close&quot; style=&quot;position:absolute;top:16px;right:16px&quot;&gt;✕&lt;/button&gt;
    &lt;h2 style=&quot;font-family:var(--font-display);font-size:18px;color:var(--gold-primary);margin-bottom:6px&quot;&gt;ID10 — Remove &amp;amp; Upgrade&lt;/h2&gt;
    &lt;div style=&quot;font-size:13px;color:var(--text-muted);line-height:1.7;display:flex;flex-direction:column;gap:12px&quot;&gt;
      &lt;div&gt;&lt;div style=&quot;font-size:11px;color:var(--gold-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px&quot;&gt;The Mechanic&lt;/div&gt;
        Randomly removes 1 or 2 cogs from the stage (50/50) and upgrades all remaining cogs by +1 rarity. Fewer cogs = lower rating at turnin, but every remaining cog gives better vouchers.&lt;/div&gt;
      &lt;div&gt;&lt;div style=&quot;font-size:11px;color:var(--gold-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px&quot;&gt;Why It Ranks Low&lt;/div&gt;
        The removal is random — your best cogs can be taken. Losing cogs also drops your rating (6→5 = SS→S, 6→4 = SS→A), reducing the multiplier on all remaining cogs. The upgrade value rarely compensates for the combined cog loss and rating downgrade.&lt;/div&gt;
      &lt;div&gt;&lt;div style=&quot;font-size:11px;color:var(--gold-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px&quot;&gt;EV Model&lt;/div&gt;
        &lt;div style=&quot;background:var(--bg-card);border-radius:var(--radius);padding:10px;font-size:12px;font-family:monospace&quot;&gt;50% × (cr × upgraded_value × 5 cogs × S rating − base)&lt;br&gt;+ 50% × (cr × upgraded_value × 4 cogs × A rating − base)&lt;/div&gt;
        Remove-to-4 is near break-even. Remove-to-5 adds modest value. Net result: low B-tier in most configurations.&lt;/div&gt;
    &lt;/div&gt;
  &lt;/div&gt;
&lt;/div&gt;

&lt;!-- ID11 Lightbox --&gt;
&lt;div id=&quot;id11-lightbox&quot; class=&quot;overlay&quot; style=&quot;display:none;align-items:center;justify-content:center&quot;&gt;
  &lt;div onclick=&quot;event.stopPropagation()&quot; class=&quot;overlay-panel&quot; style=&quot;max-width:520px;width:100%;max-height:85vh;overflow-y:auto&quot;&gt;
    &lt;button onclick=&quot;document.getElementById('id11-lightbox').style.display='none';document.body.style.overflow='';&quot; class=&quot;overlay-close&quot; style=&quot;position:absolute;top:16px;right:16px&quot;&gt;✕&lt;/button&gt;
    &lt;h2 style=&quot;font-family:var(--font-display);font-size:18px;color:var(--gold-primary);margin-bottom:6px&quot;&gt;ID11 — 6 Cog SSS Stage&lt;/h2&gt;
    &lt;div style=&quot;font-size:13px;color:var(--text-muted);line-height:1.7;display:flex;flex-direction:column;gap:12px&quot;&gt;
      &lt;div&gt;&lt;div style=&quot;font-size:11px;color:var(--gold-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px&quot;&gt;The Mechanic&lt;/div&gt;
        6 cogwheels in stage. Rating starts below B and won't progress until cog 3 completes, which triggers a jump to SSS. cb_55 (+1 rating at turnin) is baked in — SSS is the cap so cb_55 has no further effect here.&lt;/div&gt;
      &lt;div&gt;&lt;div style=&quot;font-size:11px;color:var(--gold-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px&quot;&gt;SSS Multipliers&lt;/div&gt;
        &lt;div style=&quot;background:var(--bg-card);border-radius:var(--radius);padding:10px;font-size:12px&quot;&gt;
          &lt;div&gt;SSS rating: &lt;span style=&quot;color:var(--gold-bright)&quot;&gt;1.6× Drop Quantity&lt;/span&gt;&lt;/div&gt;
          &lt;div&gt;clockwork_51: &lt;span style=&quot;color:var(--gold-bright)&quot;&gt;+18% additional DQ at SSS&lt;/span&gt;&lt;/div&gt;
          &lt;div style=&quot;margin-top:4px;color:var(--text-faint)&quot;&gt;Combined: 6 cogs × 1.6 × 1.18 = &lt;span style=&quot;color:var(--gold-bright)&quot;&gt;11.33× base cog value&lt;/span&gt;&lt;/div&gt;
        &lt;/div&gt;&lt;/div&gt;
      &lt;div&gt;&lt;div style=&quot;font-size:11px;color:var(--gold-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px&quot;&gt;Why It's Mid Without Probe&lt;/div&gt;
        Without a probe, ID11's raw voucher EV is modest (~30% of base). Its real value is the SSS rating during the stage — which matters significantly for the Compass Probe (goblins inherit SSS multiplier) and the In-Map Season Mechanic (cb_47 scales with rating). With Compass Probe + Season Mechanic active, ID11 becomes one of the best picks.&lt;/div&gt;
      &lt;div&gt;&lt;div style=&quot;font-size:11px;color:var(--gold-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px&quot;&gt;EV Model&lt;/div&gt;
        &lt;div style=&quot;background:var(--bg-card);border-radius:var(--radius);padding:10px;font-size:12px;font-family:monospace&quot;&gt;bge(cr) × 6 × 1.6 × 1.18 − theorBase&lt;/div&gt;&lt;/div&gt;
    &lt;/div&gt;
  &lt;/div&gt;
&lt;/div&gt;

&lt;!-- ID29 Lightbox --&gt;
&lt;div id=&quot;id29-lightbox&quot; class=&quot;overlay&quot; style=&quot;display:none;align-items:center;justify-content:center&quot;&gt;
  &lt;div onclick=&quot;event.stopPropagation()&quot; class=&quot;overlay-panel&quot; style=&quot;max-width:520px;width:100%;max-height:85vh;overflow-y:auto&quot;&gt;
    &lt;button onclick=&quot;document.getElementById('id29-lightbox').style.display='none';document.body.style.overflow='';&quot; class=&quot;overlay-close&quot; style=&quot;position:absolute;top:16px;right:16px&quot;&gt;✕&lt;/button&gt;
    &lt;h2 style=&quot;font-family:var(--font-display);font-size:18px;color:var(--gold-primary);margin-bottom:6px&quot;&gt;ID29 — Hunting Ground&lt;/h2&gt;
    &lt;div style=&quot;font-size:13px;color:var(--text-muted);line-height:1.7;display:flex;flex-direction:column;gap:12px&quot;&gt;
      &lt;div&gt;&lt;div style=&quot;font-size:11px;color:var(--gold-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px&quot;&gt;The Mechanic&lt;/div&gt;
        Time gained per cog is doubled. 50% chance per cog completion for 1 extra Cogwheel Voucher (up to Orange). Default rating is S (1.3×).&lt;/div&gt;
      &lt;div&gt;&lt;div style=&quot;font-size:11px;color:var(--gold-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px&quot;&gt;EV Model&lt;/div&gt;
        Two separate components combined:
        &lt;div style=&quot;background:var(--bg-card);border-radius:var(--radius);padding:10px;font-size:12px;font-family:monospace;margin-top:6px&quot;&gt;Base pool × S rating (1.3×) − theorBase&lt;br&gt;+ n cogs × 50% × avg extra voucher value × S rating&lt;/div&gt;
        The doubled time is not directly modeled in EV — it affects survivability and timing-conditional services (ID26/27) but not base voucher output.&lt;/div&gt;
    &lt;/div&gt;
  &lt;/div&gt;
&lt;/div&gt;

&lt;!-- ID32 Lightbox --&gt;
&lt;div id=&quot;id32-lightbox&quot; class=&quot;overlay&quot; style=&quot;display:none;align-items:center;justify-content:center&quot;&gt;
  &lt;div onclick=&quot;event.stopPropagation()&quot; class=&quot;overlay-panel&quot; style=&quot;max-width:520px;width:100%;max-height:85vh;overflow-y:auto&quot;&gt;
    &lt;button onclick=&quot;document.getElementById('id32-lightbox').style.display='none';document.body.style.overflow='';&quot; class=&quot;overlay-close&quot; style=&quot;position:absolute;top:16px;right:16px&quot;&gt;✕&lt;/button&gt;
    &lt;h2 style=&quot;font-family:var(--font-display);font-size:18px;color:var(--gold-primary);margin-bottom:6px&quot;&gt;ID32 — Bloody Mary&lt;/h2&gt;
    &lt;div style=&quot;font-size:13px;color:var(--text-muted);line-height:1.7;display:flex;flex-direction:column;gap:12px&quot;&gt;
      &lt;div&gt;&lt;div style=&quot;font-size:11px;color:var(--gold-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px&quot;&gt;The Mechanic&lt;/div&gt;
        Immediately grants 3–5 Purple+ vouchers (avg 4). Default rating upgraded to SS (1.45×). Bloody Mary starts chasing you after 3s — failure to submit vouchers causes you to lose the challenge and forfeit rewards.&lt;/div&gt;
      &lt;div&gt;&lt;div style=&quot;font-size:11px;color:var(--gold-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px&quot;&gt;EV Model&lt;/div&gt;
        &lt;div style=&quot;background:var(--bg-card);border-radius:var(--radius);padding:10px;font-size:12px;font-family:monospace&quot;&gt;4 avg vouchers × SS rating (Purple/Gold 50/50)&lt;br&gt;+ base pool × SS rating (1.45×) − theorBase&lt;/div&gt;
        The Bloody Mary mechanic is not modeled — it adds time pressure but if you submit successfully, EV is as above. The 3s timer is tight; builds that can clear fast benefit more.&lt;/div&gt;
    &lt;/div&gt;
  &lt;/div&gt;
&lt;/div&gt;

&lt;!-- ID35 Lightbox --&gt;
&lt;div id=&quot;id35-lightbox&quot; class=&quot;overlay&quot; style=&quot;display:none;align-items:center;justify-content:center&quot;&gt;
  &lt;div onclick=&quot;event.stopPropagation()&quot; class=&quot;overlay-panel&quot; style=&quot;max-width:520px;width:100%;max-height:85vh;overflow-y:auto&quot;&gt;
    &lt;button onclick=&quot;document.getElementById('id35-lightbox').style.display='none';document.body.style.overflow='';&quot; class=&quot;overlay-close&quot; style=&quot;position:absolute;top:16px;right:16px&quot;&gt;✕&lt;/button&gt;
    &lt;h2 style=&quot;font-family:var(--font-display);font-size:18px;color:var(--gold-primary);margin-bottom:6px&quot;&gt;ID35 — Nut Trick&lt;/h2&gt;
    &lt;div style=&quot;font-size:13px;color:var(--text-muted);line-height:1.7;display:flex;flex-direction:column;gap:12px&quot;&gt;
      &lt;div&gt;&lt;div style=&quot;font-size:11px;color:var(--gold-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px&quot;&gt;The Mechanic&lt;/div&gt;
        Player controls which cogwheels to complete. If you complete 3 of the same rarity in a row, all 3 become Rainbow vouchers. Strategic — you choose the order to maximize proc chances.&lt;/div&gt;
      &lt;div&gt;&lt;div style=&quot;font-size:11px;color:var(--gold-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px&quot;&gt;Binomial Model (200k Monte Carlo)&lt;/div&gt;
        &lt;div style=&quot;background:var(--bg-card);border-radius:var(--radius);padding:10px;font-size:12px&quot;&gt;
          &lt;div style=&quot;margin-bottom:4px;color:var(--text-faint)&quot;&gt;6 gears:&lt;/div&gt;
          &lt;div&gt;P(0 procs): 1.0% · P(1 proc): 77.6% · P(2 procs): 21.4%&lt;/div&gt;
          &lt;div style=&quot;margin-top:6px;color:var(--text-faint)&quot;&gt;7 gears:&lt;/div&gt;
          &lt;div&gt;P(0 procs): 0% · P(1 proc): 47.0% · P(2 procs): 53.0%&lt;/div&gt;
        &lt;/div&gt;&lt;/div&gt;
      &lt;div&gt;&lt;div style=&quot;font-size:11px;color:var(--gold-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px&quot;&gt;EV Model&lt;/div&gt;
        &lt;div style=&quot;background:var(--bg-card);border-radius:var(--radius);padding:10px;font-size:12px;font-family:monospace&quot;&gt;P(1 proc) × 3 × (rainbow − avg_cog) × rating&lt;br&gt;+ P(2 procs) × 6 × (rainbow − avg_cog) × rating&lt;/div&gt;
        Each proc upgrades 3 cogs to Rainbow. The upgrade value is the difference between Rainbow and the average cog voucher value.&lt;/div&gt;
      &lt;div style=&quot;font-size:11px;color:var(--text-faint);padding-top:8px;border-top:1px solid var(--border-blue)&quot;&gt;
        Nut Trick is player-skill dependent — a player who optimally sequences cog completions gets full value. Suboptimal play reduces procs.&lt;/div&gt;
    &lt;/div&gt;
  &lt;/div&gt;
&lt;/div&gt;
&lt;!-- ID23 Lightbox --&gt;
&lt;div id=&quot;id23-lightbox&quot; class=&quot;overlay&quot; style=&quot;display:none;align-items:center;justify-content:center&quot;&gt;
  &lt;div onclick=&quot;event.stopPropagation()&quot; style=&quot;background:var(--bg-panel);border:1px solid var(--border-soft);border-radius:var(--radius-lg);max-width:560px;width:100%;padding:28px;position:relative;max-height:85vh;overflow-y:auto&quot;&gt;
    &lt;button onclick=&quot;hideId23Lightbox()&quot; class=&quot;overlay-close&quot; style=&quot;position:absolute;top:16px;right:16px&quot;&gt;✕&lt;/button&gt;
    &lt;h2 style=&quot;font-family:var(--font-display);font-size:18px;color:var(--gold-primary);margin-bottom:6px&quot;&gt;ID23 — Completing Operation Cogwheel&lt;/h2&gt;
    &lt;p style=&quot;font-size:11px;color:var(--text-faint);margin-bottom:18px&quot;&gt;How the EV model works for this service&lt;/p&gt;
    &lt;div style=&quot;font-size:13px;color:var(--text-muted);line-height:1.7;display:flex;flex-direction:column;gap:14px&quot;&gt;
      &lt;div&gt;&lt;div style=&quot;font-size:11px;color:var(--gold-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px&quot;&gt;The Mechanic&lt;/div&gt;
        Each cogwheel completion has a 40% chance for +1 extra voucher, 20% for +2, 5% for +3, and a 10% chance to immediately end the game and send you to the podium with all vouchers so far.&lt;/div&gt;
      &lt;div&gt;&lt;div style=&quot;font-size:11px;color:var(--gold-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px&quot;&gt;Early End vs Full Completion&lt;/div&gt;
        &lt;ul style=&quot;padding-left:16px;display:flex;flex-direction:column;gap:4px&quot;&gt;
          &lt;li&gt;&lt;strong style=&quot;color:var(--text-soft)&quot;&gt;Early end (cogs 1 to n-1):&lt;/strong&gt; Safe cashout — keep all vouchers, go to podium immediately. No wipe risk. Rating based on cogs completed — fewer cogs = lower multiplier. Podium procs (cb_59, Wasteful, Ostentatious) do NOT fire.&lt;/li&gt;
          &lt;li&gt;&lt;strong style=&quot;color:var(--text-soft)&quot;&gt;Full completion (last cog survives):&lt;/strong&gt; Normal run completion. Full rating multiplier. All podium procs fire normally.&lt;/li&gt;
        &lt;/ul&gt;&lt;/div&gt;
      &lt;div&gt;&lt;div style=&quot;font-size:11px;color:var(--gold-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px&quot;&gt;Reading the Outcomes&lt;/div&gt;
        Each row shows a possible outcome with its probability. Early end at low cogs produces less than a normal run. Full completion is the target. The tier in the service rankings is the weighted average across all outcomes.&lt;/div&gt;
      &lt;div&gt;&lt;div style=&quot;font-size:11px;color:var(--gold-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px&quot;&gt;Encounter Rate &amp;amp; Real-World Value&lt;/div&gt;
        ID23 is a Gold service (~12.5% encounter rate). You see it multiple times per session regardless of how many maps you run — unlike Roulette, it contributes meaningfully every day you map.
        &lt;div style=&quot;background:var(--bg-card);border-radius:var(--radius);padding:10px 12px;font-size:12px;display:flex;flex-direction:column;gap:4px;margin-top:8px&quot;&gt;
          &lt;div style=&quot;color:var(--text-faint);margin-bottom:2px&quot;&gt;Per-session reliability (100k simulation):&lt;/div&gt;
          &lt;div style=&quot;display:flex;justify-content:space-between&quot;&gt;&lt;span style=&quot;color:var(--text-faint)&quot;&gt;20 maps (casual):&lt;/span&gt;&lt;span style=&quot;color:var(--green-recording)&quot;&gt;~2.5 encounters · goes negative 3% of sessions&lt;/span&gt;&lt;/div&gt;
          &lt;div style=&quot;display:flex;justify-content:space-between&quot;&gt;&lt;span style=&quot;color:var(--text-faint)&quot;&gt;30 maps:&lt;/span&gt;&lt;span style=&quot;color:var(--green-recording)&quot;&gt;~3.8 encounters · goes negative 1.5% of sessions&lt;/span&gt;&lt;/div&gt;
          &lt;div style=&quot;display:flex;justify-content:space-between&quot;&gt;&lt;span style=&quot;color:var(--text-faint)&quot;&gt;100 maps (streamer):&lt;/span&gt;&lt;span style=&quot;color:var(--green-recording)&quot;&gt;~12.5 encounters · never negative&lt;/span&gt;&lt;/div&gt;
          &lt;div style=&quot;display:flex;justify-content:space-between;margin-top:4px&quot;&gt;&lt;span style=&quot;color:var(--text-faint)&quot;&gt;Reliable positive at:&lt;/span&gt;&lt;span style=&quot;color:var(--gold-muted)&quot;&gt;100 maps (100% of the time)&lt;/span&gt;&lt;/div&gt;
        &lt;/div&gt;
        &lt;div style=&quot;margin-top:8px;font-size:12px;color:var(--text-faint)&quot;&gt;The safe cashout mechanic means even bad runs return something. This is what separates ID23 from Roulette in practice — consistent value every session vs Roulette's feast/famine across months of mapping.&lt;/div&gt;&lt;/div&gt;
      &lt;div style=&quot;font-size:11px;color:var(--text-faint);padding-top:10px;border-top:1px solid var(--border-blue)&quot;&gt;
        Mechanic data from the &lt;a href=&quot;https://docs.qq.com/doc/DUFZyZFZRWnVtUVFt&quot; target=&quot;_blank&quot; rel=&quot;noopener&quot; style=&quot;color:var(--blue-light)&quot;&gt;Chinese community doc&lt;/a&gt;.&lt;/div&gt;
    &lt;/div&gt;
  &lt;/div&gt;
&lt;/div&gt;

&lt;!-- Alice Proc Lightbox --&gt;
&lt;div id=&quot;alice-lightbox&quot; class=&quot;overlay&quot; style=&quot;display:none;align-items:center;justify-content:center&quot;&gt;
  &lt;div onclick=&quot;event.stopPropagation()&quot; class=&quot;overlay-panel&quot; style=&quot;max-width:520px;width:100%;max-height:85vh;overflow-y:auto&quot;&gt;
    &lt;button onclick=&quot;hideAliceLightbox()&quot; class=&quot;overlay-close&quot; style=&quot;position:absolute;top:16px;right:16px&quot;&gt;✕&lt;/button&gt;
    &lt;h2 style=&quot;font-family:var(--font-display);font-size:18px;color:var(--gold-primary);margin-bottom:6px&quot;&gt;Alice — Proc Voucher Bonus&lt;/h2&gt;
    &lt;p style=&quot;font-size:11px;color:var(--text-faint);margin-bottom:18px&quot;&gt;How the per-run bonus is calculated&lt;/p&gt;
    &lt;div style=&quot;font-size:13px;color:var(--text-muted);line-height:1.7;display:flex;flex-direction:column;gap:14px&quot;&gt;
      &lt;div&gt;&lt;div style=&quot;font-size:11px;color:var(--gold-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px&quot;&gt;What Alice Proc Does&lt;/div&gt;
        Alice (Lv2+) has a chance per cogwheel completion to add a free Cogwheel Voucher directly to your total. Separate from her Double Reward effect. Cannot self-proc.&lt;/div&gt;
      &lt;div&gt;&lt;div style=&quot;font-size:11px;color:var(--gold-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px&quot;&gt;Proc Chances by Level&lt;/div&gt;
        &lt;div style=&quot;font-size:12px;color:var(--text-faint)&quot;&gt;Lv2-3: 8% per cog · Lv4-5: 16% per cog · Lv6: 16% per cog&lt;/div&gt;&lt;/div&gt;
      &lt;div&gt;&lt;div style=&quot;font-size:11px;color:var(--gold-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px&quot;&gt;Voucher Distribution&lt;/div&gt;
        Estimated from player observation: Grey ~2%, Blue ~38%, Purple ~38%, Gold ~16%, Red ~4%, Rainbow ~2%. &lt;span style=&quot;color:var(--red-loss)&quot;&gt;Unverified.&lt;/span&gt;&lt;/div&gt;
    &lt;/div&gt;
  &lt;/div&gt;
&lt;/div&gt;

&lt;!-- Roulette Lightbox --&gt;
&lt;div id=&quot;roulette-lightbox&quot; class=&quot;overlay&quot; style=&quot;display:none;align-items:center;justify-content:center&quot;&gt;
  &lt;div onclick=&quot;event.stopPropagation()&quot; style=&quot;background:var(--bg-panel);border:1px solid var(--border-soft);border-radius:var(--radius-lg);max-width:560px;width:100%;padding:28px;position:relative;max-height:85vh;overflow-y:auto&quot;&gt;
    &lt;button onclick=&quot;hideRouletteLightbox()&quot; class=&quot;overlay-close&quot; style=&quot;position:absolute;top:16px;right:16px&quot;&gt;✕&lt;/button&gt;
    &lt;h2 style=&quot;font-family:var(--font-display);font-size:18px;color:var(--gold-primary);margin-bottom:6px&quot;&gt;Clockwork Roulette — Strategy&lt;/h2&gt;
    &lt;p style=&quot;font-size:11px;color:var(--text-faint);margin-bottom:18px&quot;&gt;The math depends on which fail model is true — pick one above to see how it changes things&lt;/p&gt;
    &lt;div style=&quot;font-size:13px;color:var(--text-muted);line-height:1.7;display:flex;flex-direction:column;gap:14px&quot;&gt;
      &lt;div&gt;&lt;div style=&quot;font-size:11px;color:var(--gold-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px&quot;&gt;Two Possible Fail Models — Unresolved&lt;/div&gt;
        The game says &quot;10% fail per cog start.&quot; This could mean two very different things:
        &lt;div style=&quot;background:var(--bg-card);border-radius:var(--radius);padding:10px 12px;font-size:12px;display:flex;flex-direction:column;gap:8px;margin-top:8px&quot;&gt;
          &lt;div&gt;&lt;b style=&quot;color:var(--text-soft)&quot;&gt;Flat (10% every cog):&lt;/b&gt; Each cog independently has a 10% fail chance — the rate itself never changes. Survival to cog 6 = 0.9⁶ = 53.1%. Under this model, EV is always positive and grows with each cog — &lt;span style=&quot;color:var(--gold-muted)&quot;&gt;always push to max cogs&lt;/span&gt;.&lt;/div&gt;
          &lt;div&gt;&lt;b style=&quot;color:var(--text-soft)&quot;&gt;Escalating (10%→47%):&lt;/b&gt; The fail chance itself grows each cog — cog 1=10%, cog 2=19%, cog 3=27%, cog 4=34%, cog 5=41%, cog 6=47%. Survival to cog 6 drops to just 10.9%. Under this model, EV peaks around cog 4 and going to cog 6 is barely break-even — &lt;span style=&quot;color:var(--gold-muted)&quot;&gt;pushing to max cogs is a mistake&lt;/span&gt;.&lt;/div&gt;
        &lt;/div&gt;
        &lt;div style=&quot;margin-top:8px;font-size:12px;color:var(--text-faint)&quot;&gt;Community read: going past cog 3 &quot;feels like a coinflip,&quot; and cog 4-5+ feels progressively scarier — consistent with the escalating model (53%→35%→21%→11%) more than flat (73%→66%→59%→53%). But this is subjective and unverified. Use the dropdown above to see both.&lt;/div&gt;&lt;/div&gt;
      &lt;div&gt;&lt;div style=&quot;font-size:11px;color:var(--gold-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px&quot;&gt;How It Works&lt;/div&gt;
        Each cogwheel gives you vouchers plus 1 extra random voucher, and the next cog gives +1 more than the last — so vouchers escalate fast. Each cog start has a flat 10% chance to wipe: the event ends immediately and you lose everything.&lt;/div&gt;
      &lt;div&gt;&lt;div style=&quot;font-size:11px;color:var(--gold-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px&quot;&gt;The Hard Numbers&lt;/div&gt;
        &lt;div style=&quot;background:var(--bg-card);border-radius:var(--radius);padding:10px 12px;font-size:12px;display:flex;flex-direction:column;gap:4px&quot;&gt;
          &lt;div style=&quot;display:flex;justify-content:space-between&quot;&gt;&lt;span style=&quot;color:var(--text-faint)&quot;&gt;Complete all 6 cogs:&lt;/span&gt;&lt;span style=&quot;color:var(--orange-fire)&quot;&gt;53% of runs&lt;/span&gt;&lt;/div&gt;
          &lt;div style=&quot;display:flex;justify-content:space-between&quot;&gt;&lt;span style=&quot;color:var(--text-faint)&quot;&gt;Wipe before cog 4:&lt;/span&gt;&lt;span style=&quot;color:var(--red-loss)&quot;&gt;27% of runs — zero reward&lt;/span&gt;&lt;/div&gt;
          &lt;div style=&quot;display:flex;justify-content:space-between&quot;&gt;&lt;span style=&quot;color:var(--text-faint)&quot;&gt;Breakeven (conservative voucher dist):&lt;/span&gt;&lt;span style=&quot;color:var(--text-soft)&quot;&gt;cog 4&lt;/span&gt;&lt;/div&gt;
          &lt;div style=&quot;display:flex;justify-content:space-between&quot;&gt;&lt;span style=&quot;color:var(--text-faint)&quot;&gt;Breakeven (high rarity voucher dist):&lt;/span&gt;&lt;span style=&quot;color:var(--text-soft)&quot;&gt;cog 2&lt;/span&gt;&lt;/div&gt;
          &lt;div style=&quot;display:flex;justify-content:space-between&quot;&gt;&lt;span style=&quot;color:var(--text-faint)&quot;&gt;EV at cog 6 (conservative):&lt;/span&gt;&lt;span style=&quot;color:var(--green-recording)&quot;&gt;+141% of base run value&lt;/span&gt;&lt;/div&gt;
          &lt;div style=&quot;display:flex;justify-content:space-between&quot;&gt;&lt;span style=&quot;color:var(--text-faint)&quot;&gt;EV at cog 6 (high rarity):&lt;/span&gt;&lt;span style=&quot;color:var(--green-recording)&quot;&gt;+547% of base run value&lt;/span&gt;&lt;/div&gt;
        &lt;/div&gt;
        Frequent wipes on cog 4–5 are not bad RNG. Nearly half of all Roulette runs zero out. That is the mechanic working as intended.&lt;/div&gt;
      &lt;div&gt;&lt;div style=&quot;font-size:11px;color:var(--gold-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px&quot;&gt;Why Max Cogs Is Always Correct&lt;/div&gt;
        Cog 6 gives 27 vouchers. Cog 3 gives 9. The runs that survive and pay out are so valuable that they more than cover the runs that wipe — mathematically, every early cashout costs EV regardless of how the run has gone so far.&lt;/div&gt;
      &lt;div&gt;&lt;div style=&quot;font-size:11px;color:var(--gold-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px&quot;&gt;&quot;But I'm Seeing Rainbow Vouchers — Should I Cash Out?&quot;&lt;/div&gt;
        No. Seeing high rarity drops early means this is exactly the run you want to complete. Those early cogs are just the start — cog 6 on a high rarity run is where the real payout is. Cashing out at cog 3 because you already got a rainbow is leaving most of the value behind. The temptation to lock in a good start is understandable, but the math is clear: keep going.&lt;/div&gt;
      &lt;div&gt;&lt;div style=&quot;font-size:11px;color:var(--gold-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px&quot;&gt;When It's Okay to Stop Early&lt;/div&gt;
        &lt;b&gt;Under flat:&lt;/b&gt; stopping early is a variance-management trade — you give up EV for stability, not playing &quot;better.&quot;&lt;br&gt;&lt;br&gt;
        &lt;b&gt;Under escalating:&lt;/b&gt; stopping at the ★-marked optimal cog (shown in the table above for your gear count) isn't a trade-off at all — it IS the better play. Pushing past it loses both EV and increases variance.&lt;/div&gt;
      &lt;div&gt;&lt;div style=&quot;font-size:11px;color:var(--gold-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px&quot;&gt;Encounter Rate &amp;amp; The Season Reality&lt;/div&gt;
        Roulette is a Rainbow service (~1% encounter rate). At real-world mapping rates you see it roughly once per 100 maps. At full deep-space juice a failed Roulette is a lost map — clockwork IS the map value.
        &lt;div style=&quot;background:var(--bg-card);border-radius:var(--radius);padding:10px 12px;font-size:12px;display:flex;flex-direction:column;gap:4px;margin-top:8px&quot;&gt;
          &lt;div style=&quot;color:var(--text-faint);margin-bottom:2px&quot;&gt;When you see it — per-encounter result:&lt;/div&gt;
          &lt;div style=&quot;display:flex;justify-content:space-between&quot;&gt;&lt;span style=&quot;color:var(--text-faint)&quot;&gt;Goes negative (wipe):&lt;/span&gt;&lt;span style=&quot;color:var(--red-loss)&quot;&gt;~43% of encounters&lt;/span&gt;&lt;/div&gt;
          &lt;div style=&quot;display:flex;justify-content:space-between&quot;&gt;&lt;span style=&quot;color:var(--text-faint)&quot;&gt;Floor (P10):&lt;/span&gt;&lt;span style=&quot;color:var(--text-soft)&quot;&gt;−1 map cost&lt;/span&gt;&lt;/div&gt;
          &lt;div style=&quot;display:flex;justify-content:space-between&quot;&gt;&lt;span style=&quot;color:var(--text-faint)&quot;&gt;Average win:&lt;/span&gt;&lt;span style=&quot;color:var(--green-recording)&quot;&gt;+4.9× map cost profit&lt;/span&gt;&lt;/div&gt;
          &lt;div style=&quot;display:flex;justify-content:space-between&quot;&gt;&lt;span style=&quot;color:var(--text-faint)&quot;&gt;Reliable positive at:&lt;/span&gt;&lt;span style=&quot;color:var(--gold-muted)&quot;&gt;~500 maps (93%)&lt;/span&gt;&lt;/div&gt;
        &lt;/div&gt;
        &lt;div style=&quot;margin-top:8px;font-size:12px;color:var(--red-loss)&quot;&gt;At ~1 encounter per 100 maps, 500 maps = ~5 Roulettes. That's roughly one full 90-day season of serious mapping before the EV advantage meaningfully materializes. The &quot;feels like always skip&quot; instinct is statistically valid for anyone outside streamer/nolifer territory.&lt;/div&gt;&lt;/div&gt;
      &lt;div style=&quot;font-size:11px;color:var(--text-faint);padding-top:10px;border-top:1px solid var(--border-blue)&quot;&gt;
        &lt;span style=&quot;color:var(--red-loss)&quot;&gt;Voucher rarity distribution is unverified&lt;/span&gt; — the difference between conservative and high rarity is dramatic and this remains the biggest unknown in the Roulette ranking. Mechanic data from the &lt;a href=&quot;https://docs.qq.com/doc/DUFZyZFZRWnVtUVFt&quot; target=&quot;_blank&quot; rel=&quot;noopener&quot; style=&quot;color:var(--blue-light)&quot;&gt;Chinese community doc&lt;/a&gt;.&lt;/div&gt;
    &lt;/div&gt;
  &lt;/div&gt;
&lt;/div&gt;

&lt;!-- Reroll Decision Lightbox --&gt;
&lt;div id=&quot;lightbox-overlay&quot; onclick=&quot;hideLightbox()&quot; class=&quot;overlay&quot; style=&quot;display:none;align-items:center;justify-content:center&quot;&gt;
  &lt;div onclick=&quot;event.stopPropagation()&quot; style=&quot;background:var(--bg-panel);border:1px solid var(--border-soft);border-radius:var(--radius-lg);max-width:560px;width:100%;padding:28px;position:relative;max-height:85vh;overflow-y:auto&quot;&gt;
    &lt;button onclick=&quot;hideLightbox()&quot; class=&quot;overlay-close&quot; style=&quot;position:absolute;top:16px;right:16px&quot;&gt;✕&lt;/button&gt;
    &lt;h2 style=&quot;font-family:var(--font-display);font-size:18px;color:var(--gold-primary);margin-bottom:6px&quot;&gt;Reroll Recommendation&lt;/h2&gt;
    &lt;p style=&quot;font-size:11px;color:var(--text-faint);margin-bottom:18px&quot;&gt;How the Keep / Reroll decision is calculated&lt;/p&gt;
    &lt;div style=&quot;font-size:13px;color:var(--text-muted);line-height:1.7;display:flex;flex-direction:column;gap:14px&quot;&gt;
      &lt;div&gt;&lt;div style=&quot;font-size:11px;color:var(--gold-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px&quot;&gt;The Core Question&lt;/div&gt;
        Is your best current option worth more than what you'd expect from a reroll? If rerolling gives a better expected outcome on average, reroll.&lt;/div&gt;
      &lt;div&gt;&lt;div style=&quot;font-size:11px;color:var(--gold-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px&quot;&gt;Pool Average EV&lt;/div&gt;
        The service pool is weighted by rarity — Bronze (~54%), Amethyst (~43%), Gold (~3%), Rainbow (~0.5%). The expected value of a random draw from this weighted pool sets the baseline. &lt;span style=&quot;color:var(--red-loss)&quot;&gt;Pool weights from Chinese community doc — reflect clockwork quality nodes. Builds with clockwork_41/42/45/46 see more Gold/Diamond services.&lt;/span&gt;&lt;/div&gt;
      &lt;div&gt;&lt;div style=&quot;font-size:11px;color:var(--gold-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px&quot;&gt;Why Thresholds Differ by Rerolls&lt;/div&gt;
        With 2 rerolls you get two chances to improve — so you should be more selective on the first reroll. With 1 reroll left you take S or A since the next draw might be worse.
        &lt;div style=&quot;margin-top:8px;display:flex;flex-direction:column;gap:4px&quot;&gt;
          &lt;div style=&quot;display:flex;gap:8px;font-size:12px&quot;&gt;&lt;span style=&quot;color:var(--text-faint);width:160px&quot;&gt;Reroll 1 of 2:&lt;/span&gt;&lt;span&gt;Keep S+ or S only&lt;/span&gt;&lt;/div&gt;
          &lt;div style=&quot;display:flex;gap:8px;font-size:12px&quot;&gt;&lt;span style=&quot;color:var(--text-faint);width:160px&quot;&gt;Reroll 2 of 2 (last):&lt;/span&gt;&lt;span&gt;Keep S+, S, or A&lt;/span&gt;&lt;/div&gt;
        &lt;/div&gt;&lt;/div&gt;
      &lt;div&gt;&lt;div style=&quot;font-size:11px;color:var(--gold-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px&quot;&gt;Tier Thresholds&lt;/div&gt;
        &lt;div style=&quot;display:flex;flex-direction:column;gap:3px;font-size:12px&quot;&gt;
          &lt;div style=&quot;display:flex;gap:8px&quot;&gt;&lt;span style=&quot;width:40px;color:#ff9ef5;font-weight:700&quot;&gt;S+&lt;/span&gt;&lt;span&gt;≥35% of Roses (Roses, Nut Trick)&lt;/span&gt;&lt;/div&gt;
          &lt;div style=&quot;display:flex;gap:8px&quot;&gt;&lt;span style=&quot;width:40px;color:var(--gold-bright);font-weight:700&quot;&gt;S&lt;/span&gt;&lt;span&gt;12–35% (Heist, All Tabs, Bloody Mary, ID23)&lt;/span&gt;&lt;/div&gt;
          &lt;div style=&quot;display:flex;gap:8px&quot;&gt;&lt;span style=&quot;width:40px;color:#a78bfa;font-weight:700&quot;&gt;A&lt;/span&gt;&lt;span&gt;5–12% (ID20, ID9, Hunting Ground, ID19)&lt;/span&gt;&lt;/div&gt;
          &lt;div style=&quot;display:flex;gap:8px&quot;&gt;&lt;span style=&quot;width:40px;color:#60a5fa;font-weight:700&quot;&gt;B&lt;/span&gt;&lt;span&gt;2–5% (ID26, ID15, ID17, ID21, ID11, ID27...)&lt;/span&gt;&lt;/div&gt;
          &lt;div style=&quot;display:flex;gap:8px&quot;&gt;&lt;span style=&quot;width:40px;color:var(--text-faint);font-weight:700&quot;&gt;C&lt;/span&gt;&lt;span&gt;1–2% (minor utility services)&lt;/span&gt;&lt;/div&gt;
        &lt;/div&gt;&lt;/div&gt;
      &lt;div&gt;&lt;div style=&quot;font-size:11px;color:var(--gold-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px&quot;&gt;Caveats&lt;/div&gt;
        &lt;ul style=&quot;padding-left:16px;display:flex;flex-direction:column;gap:4px&quot;&gt;
          &lt;li&gt;Pool weights are from Chinese community doc — unverified for S12&lt;/li&gt;
          &lt;li&gt;Combat services (IDs 4-7) add survival value not captured in EV&lt;/li&gt;
          &lt;li&gt;IDs 13-14 only show value with Booster Drink / Time Extender nodes checked&lt;/li&gt;
          &lt;li&gt;Roulette EV depends on unverified voucher rarity distribution&lt;/li&gt;
          &lt;li&gt;These are long-run averages — individual runs vary widely&lt;/li&gt;
        &lt;/ul&gt;&lt;/div&gt;
      &lt;div style=&quot;font-size:11px;color:var(--text-faint);padding-top:10px;border-top:1px solid var(--border-blue)&quot;&gt;
        Model: recursive expected value — E[best of 3 draws] via 200k Monte Carlo simulation. Thresholds are scale-independent ratios.&lt;/div&gt;
    &lt;/div&gt;
  &lt;/div&gt;
&lt;/div&gt;

&lt;footer class=&quot;page-footer&quot;&gt;
  Data: tlidb.com · &lt;a href=&quot;cheatsheet.html&quot; target=&quot;_blank&quot; rel=&quot;noopener&quot;&gt;Clockwork Cheat Sheet&lt;/a&gt; · &lt;a href=&quot;https://kythik.com&quot;&gt;kythik.com&lt;/a&gt;
&lt;/footer&gt;

&lt;script&gt;
const DIST={grey:0.0002,blue:0.68886,purple:0.25295,gold:0.05399,red:0.0038,rainbow:0.0002};
const MULT={1:1.2,2:1.2,3:1.2,4:1.25,5:1.3,6:1.45,7:1.6};
const VOUCHERS={grey:0.35,blue:0.551,purple:1.1617,gold:1.8355,red:2.7,rainbow:4.3386};
const CHAIN=['grey','blue','purple','gold','red','rainbow'];
const NUT={5:{p0:0.069,p1:0.931,p2:0.000},6:{p0:0.010,p1:0.776,p2:0.214},7:{p0:0.000,p1:0.470,p2:0.530}};
const RDIST_EXP={blue:0.7429,purple:0.1714,gold:0.0571,red:0.0286};
const RDIST_HIGH={blue:0.10,purple:0.20,gold:0.35,red:0.20,rainbow:0.15};

const RLABEL={rainbow:'Rainbow',gold:'Gold',purple:'Purple',blue:'Blue'};
const RCLS={rainbow:'badge-rainbow',gold:'badge-gold',purple:'badge-purple',blue:'badge-blue'};
const RORD={rainbow:0,gold:1,purple:2,blue:3};
const ALICE_PROC_DIST={grey:0.02,blue:0.38,purple:0.38,gold:0.16,red:0.04,rainbow:0.02}; // estimated — unverified
const ALICE={none:{doubleP:0,procP:0},lv1:{doubleP:0.25,procP:0},lv23:{doubleP:0.25,procP:0.08},lv45:{doubleP:0.25,procP:0.16},lv6:{doubleP:0.3325,procP:0.16}};
const EQ={grey:1/6,blue:1/6,purple:1/6,gold:1/6,red:1/6,rainbow:1/6};
const D11={blue:0.5909,purple:0.3182,gold:0.0909};
const D12s={blue:0.7429,purple:0.1714,gold:0.0571,red:0.0286};
const D7={purple:0.5,gold:0.5};
const D9={grey:0.211,blue:0.3028,purple:0.2385,gold:0.2477};

const SEASON='s12'; // S12 Lunaria — season toggle removed
let RANKINGS=null;
let _roulFail='flat';
let _rdist='expected';
let _roulExpanded=false;

// Fetch rankings JSON on load
fetch('clockwork_rankings.json')
  .then(r=&gt;r.json())
  .then(data=&gt;{RANKINGS=data;render();})
  .catch(e=&gt;console.error('Failed to load rankings:',e));


function getRerollsFromAlice(){
  const a=document.getElementById('alice')?.value||'none';
  if(a==='lv23')return 1;
  if(a==='lv45'||a==='lv6')return 2;
  return 0;
}

function updateVerdict(){
  const rerolls=getRerollsFromAlice();
  const aliceNote=document.getElementById('reroll-alice-note');
  const noRerolls=document.getElementById('reroll-no-rerolls');
  const hasRerolls=document.getElementById('reroll-has-rerolls');
  if(!aliceNote)return;
  if(rerolls===0){
    document.getElementById('reroll-decision-panel').style.display='none';
    return;
  }
  document.getElementById('reroll-decision-panel').style.display='block';
  if(noRerolls)noRerolls.style.display='none';
  hasRerolls.style.display='block';
  const aliceVal=document.getElementById('alice')?.value||'none';
  aliceNote.textContent=rerolls+' reroll'+(rerolls&gt;1?'s':'')+' available (Alice '+aliceVal.replace('lv','Lv')+')';
  const verdict=document.getElementById('reroll-verdict');
  const label=document.getElementById('verdict-label');
  const sub=document.getElementById('verdict-sub');
  const icon=document.getElementById('verdict-icon');
  verdict.className='reroll-verdict v-keep';
  if(rerolls===2){
    label.innerHTML='&lt;div style=&quot;margin-bottom:6px&quot;&gt;Reroll 1 of 2: &lt;span style=&quot;color:var(--gold-bright)&quot;&gt;Keep S+ or S&lt;/span&gt; — reroll A and below&lt;/div&gt;&lt;div&gt;Reroll 2 of 2: &lt;span style=&quot;color:var(--gold-bright)&quot;&gt;Keep S+, S, or A&lt;/span&gt; — reroll B and below&lt;/div&gt;';
    sub.textContent='A-tier on first reroll is borderline — judgment call.';
    icon.textContent='';
  } else {
    label.textContent='Keep S+, S, or A — Reroll B and below';
    sub.textContent='Last reroll — S+/S/A worth keeping. B and below, use the reroll.';
    icon.textContent='✓';
  }
}

const WASTEFUL_DIST={gold:0.70,red:0.25,rainbow:0.05};
const OSTENTATIOUS_DIST={gold:0.70,red:0.25,rainbow:0.05};

function onWastefulClick(){
  const w=document.getElementById('node-wasteful');
  const o=document.getElementById('node-ostentatious');
  if(w.checked)o.checked=false;
  document.getElementById('exclusive-note').style.display=(w.checked||o.checked)?'block':'none';
  render();
}
function onOstentatiousClick(){
  const w=document.getElementById('node-wasteful');
  const o=document.getElementById('node-ostentatious');
  if(o.checked)w.checked=false;
  document.getElementById('exclusive-note').style.display=(w.checked||o.checked)?'block':'none';
  render();
}
const REROLL_THRESHOLDS={0:0.1536,1:0.2873,2:0.3566};
// Pool weights: Chinese community doc — reflect clockwork quality nodes. Does NOT reflect service frequency nodes (clockwork_41/42/45/46 = +60% Gold/Diamond for builds with those nodes).
const POOL_WEIGHTS={'blue':0.538,'purple':0.427,'gold':0.029,'rainbow':0.0049};
const SERVICE_RARITIES={1:'blue',2:'blue',3:'blue',4:'blue',5:'blue',6:'blue',7:'blue',8:'blue',9:'blue',10:'blue',11:'purple',13:'purple',14:'purple',15:'purple',16:'purple',17:'purple',18:'purple',19:'gold',20:'gold',21:'gold',23:'gold',26:'gold',27:'gold',28:'rainbow',29:'rainbow',30:'rainbow',31:'rainbow',32:'rainbow',33:'rainbow',35:'rainbow'};
function showAliceLightbox(){
  document.getElementById('alice-lightbox').style.display='flex';
  document.body.style.overflow='hidden';
}
function hideAliceLightbox(){
  document.getElementById('alice-lightbox').style.display='none';
  document.body.style.overflow='';
}
function showRouletteLightbox(){
  document.getElementById('roulette-lightbox').style.display='flex';
  document.body.style.overflow='hidden';
}
function hideRouletteLightbox(){
  document.getElementById('roulette-lightbox').style.display='none';
  document.body.style.overflow='';
}
function showId23Lightbox(){
  document.getElementById('id23-lightbox').style.display='flex';
  document.body.style.overflow='hidden';
}
function hideId23Lightbox(){
  document.getElementById('id23-lightbox').style.display='none';
  document.body.style.overflow='';
}
function showLightbox(){document.getElementById('lightbox-overlay').style.display='flex';document.body.style.overflow='hidden';}
function hideLightbox(){document.getElementById('lightbox-overlay').style.display='none';document.body.style.overflow='';}
document.addEventListener('keydown',e=&gt;{if(e.key==='Escape'){hideLightbox();hideRouletteLightbox();hideId23Lightbox();hideAliceLightbox();}});

function gev(r){return (VOUCHERS[r]||VOUCHERS.grey);} // cr/cf cancel in ratios — omitted
function r1u(r){const i=CHAIN.indexOf(r);return i&lt;CHAIN.length-1?CHAIN[i+1]:r;}
function bge(){return Object.entries(DIST).reduce((s,[r,p])=&gt;s+p*gev(r),0);}
function ege(dist){return Object.entries(dist).reduce((s,[r,p])=&gt;s+p*gev(r),0);}
function ug(n){return n*Object.entries(DIST).reduce((s,[r,p])=&gt;s+p*(gev(r1u(r))-gev(r)),0);}


function roulSurvival(cog,failModel){
  // Flat: each cog independently 10% fail, survival = 0.9^cog
  // Escalating: fail rate itself grows — cog k fail = 1-0.9^k
  if(failModel==='escalating'){
    let p=1;
    for(let k=1;k&lt;=cog;k++)p*=(0.9**k);
    return p;
  }
  return Math.pow(0.90,cog);
}
function roulEV(cog,n,rdist,base,failModel){
  const theorBase=bge()*n*MULT[n];
  let tv=0;for(let k=1;k&lt;=cog;k++)tv+=1+k;
  const ps=roulSurvival(cog,failModel);
  const raw=ps*tv*ege(rdist)*(MULT[cog]||1.2)-theorBase;
  return(raw/theorBase)*base;
}

function id23CogEV(k,n,base){
  const theorBase=bge()*n*MULT[n];
  const raw=k*(1+0.95)*ege(DIST)*(MULT[k]||1.2)-theorBase;
  return(raw/theorBase)*base;
}

function getTier(ev,theorBase){
  // Tiers based on % of Roses (top S+ service), not % of theorBase
  // Roses ≈ 6.124x theorBase at default config — used as reference ceiling
  if(ev&lt;=0)return{l:'F',c:'tier-f'};
  const rosesEV=theorBase*6.124;
  const p=ev/rosesEV*100;
  if(p&gt;=35)return{l:'S+',c:'tier-sp'};
  if(p&gt;=12)return{l:'S',c:'tier-s'};
  if(p&gt;=5) return{l:'A',c:'tier-a'};
  if(p&gt;=2) return{l:'B',c:'tier-b'};
  if(p&gt;=1) return{l:'C',c:'tier-c'};
  return{l:'F',c:'tier-f'};
}

function roulBlock(gearsVal,rdist,base){
  const isAvg=gearsVal==='avg',gl=isAvg?[5,6,7]:[parseInt(gearsVal)];
  const maxCog=isAvg?6:parseInt(gearsVal);
  const dl=rdist===RDIST_HIGH?'high rarity (observed, unverified)':'expected (conservative)';
  const failModel=_roulFail;
  const isEsc=failModel==='escalating';

  // Survival to max cog, encounter table values, headline guidance
  const pSurvMax=roulSurvival(maxCog,failModel);
  let evMax=isAvg?(1/3)*gl.reduce((s,n)=&gt;s+roulEV(maxCog,n,rdist,base,failModel),0):roulEV(maxCog,parseInt(gearsVal),rdist,base,failModel);

  // Find optimal cashout cog (highest EV across 1..maxCog)
  let bestCog=maxCog,bestEV=evMax;
  for(let c=1;c&lt;maxCog;c++){
    const e=isAvg?(1/3)*gl.reduce((s,n)=&gt;s+roulEV(c,n,rdist,base,failModel),0):roulEV(c,parseInt(gearsVal),rdist,base,failModel);
    if(e&gt;bestEV){bestEV=e;bestCog=c;}
  }
  const headline=isEsc
    ? (bestCog&lt;maxCog
        ? `&lt;span style=&quot;color:var(--gold-muted)&quot;&gt;Math says: cash out at cog ${bestCog}, not max&lt;/span&gt;`
        : `&lt;span style=&quot;color:var(--gold-muted)&quot;&gt;Math says: still go to max cogs&lt;/span&gt;`)
    : `&lt;span style=&quot;color:var(--gold-muted)&quot;&gt;Math says: always go to max cogs&lt;/span&gt;`;
  const failDesc=isEsc
    ? 'Escalating 10%→47% fail per cog (cog k fail = 1−0.9^k, compounding risk grows each cog)'
    : 'Flat 10% fail per cog survival = 0.9^cog)';

  let h=`&lt;div class=&quot;roul-block&quot;&gt;&lt;div class=&quot;roul-header&quot;&gt;Dist: &lt;span style=&quot;color:#a78bfa&quot;&gt;${dl}&lt;/span&gt; · ${failDesc} · Fail = entire event ends · ${headline} &lt;button onclick=&quot;showRouletteLightbox()&quot; style=&quot;background:transparent;border:none;color:var(--blue-light);font-size:10px;cursor:pointer;padding:0;margin-left:4px&quot;&gt;why? ↗&lt;/button&gt;&lt;/div&gt;`;

  // Encounter reality table - values differ by fail model
  const encRows=isEsc
    ? [['50','~0.5','--red-loss','~5% — nearly always negative'],
       ['100','~1','--red-loss','~10% — still mostly negative'],
       ['500','~5','--orange-fire','~42% — still a coin flip'],
       ['1000','~10','--gold-muted','~52% — barely above 50/50']]
    : [['50','~0.5','--red-loss','~20% — most sessions zero'],
       ['100','~1','--orange-fire','~41% — coin flip'],
       ['500','~5','--gold-muted','~93% — ~1 full season'],
       ['1000','~10','--green-recording','~99% — multiple seasons']];

  const wipeRate=((1-pSurvMax)*100).toFixed(0);
  const survBoxColor=isEsc?'rgba(220,38,38,0.12)':'rgba(220,38,38,0.08)';
  const survBoxBorder=isEsc?'rgba(220,38,38,0.35)':'rgba(220,38,38,0.25)';

  h+=`&lt;div style=&quot;background:${survBoxColor};border:1px solid ${survBoxBorder};border-radius:var(--radius);padding:8px 10px;margin:6px 0&quot;&gt;
    &lt;div style=&quot;font-size:10px;color:var(--gold-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px&quot;&gt;Encounter Reality (~1 per 100 maps · ${wipeRate}% wipe rate to cog ${maxCog})&lt;/div&gt;
    &lt;div style=&quot;display:grid;grid-template-columns:60px 70px 1fr;gap:2px 10px;font-size:11px;margin-bottom:5px&quot;&gt;
      &lt;span style=&quot;color:var(--text-faint)&quot;&gt;Maps&lt;/span&gt;&lt;span style=&quot;color:var(--text-faint)&quot;&gt;Avg seen&lt;/span&gt;&lt;span style=&quot;color:var(--text-faint)&quot;&gt;Chance of net profit&lt;/span&gt;
      ${encRows.map(r=&gt;`&lt;span style=&quot;color:var(--text-muted)&quot;&gt;${r[0]}&lt;/span&gt;&lt;span style=&quot;color:var(--text-muted)&quot;&gt;${r[1]}&lt;/span&gt;&lt;span style=&quot;color:var(${r[2]})&quot;&gt;${r[3]}&lt;/span&gt;`).join('\n      ')}
    &lt;/div&gt;
    &lt;div style=&quot;font-size:10px;color:var(--red-loss)&quot;&gt;${isEsc
      ? `Under the escalating model, going to cog ${maxCog} is barely break-even (EV≈${evMax.toFixed(2)}). Optimal stop is cog ${bestCog} (EV≈${bestEV.toFixed(2)}). Most players will not map enough for either to feel reliable.`
      : `EV is mathematically correct. Variance is the real problem — most players will not map enough in one season for Roulette to reliably pay off.`}&lt;/div&gt;
  &lt;/div&gt;`;

  h+=`&lt;div class=&quot;roul-row roul-row-head&quot;&gt;&lt;span class=&quot;roul-cog&quot;&gt;Cash out&lt;/span&gt;&lt;span class=&quot;roul-p&quot;&gt;P(survive)&lt;/span&gt;&lt;span class=&quot;roul-ev&quot;&gt;EV vs base&lt;/span&gt;&lt;span class=&quot;roul-v&quot;&gt;Vouchers&lt;/span&gt;&lt;/div&gt;`;
  for(let cog=1;cog&lt;=maxCog;cog++){
    const ps=roulSurvival(cog,failModel);
    let tv=0;for(let k=1;k&lt;=cog;k++)tv+=1+k;
    const ev=isAvg?(1/3)*gl.reduce((s,n)=&gt;s+roulEV(cog,n,rdist,base,failModel),0):roulEV(cog,parseInt(gearsVal),rdist,base,failModel);
    const ec=ev&gt;0?'pos':'neg';
    const theorBaseR=bge()*maxCog*MULT[maxCog];
    const evPctR=Math.max(0,ev/theorBaseR*100);
    const tR=ev&lt;=0?{l:'F',c:'tier-f'}:evPctR&gt;=300?{l:'S+',c:'tier-sp'}:evPctR&gt;=100?{l:'S',c:'tier-s'}:evPctR&gt;=30?{l:'A',c:'tier-a'}:evPctR&gt;=19?{l:'B',c:'tier-b'}:evPctR&gt;=5?{l:'C',c:'tier-c'}:{l:'F',c:'tier-f'};
    const bwR=Math.min(evPctR/3,100);
    const isBest=isEsc&amp;&amp;cog===bestCog?' style=&quot;background:rgba(200,164,93,0.06)&quot;':'';
    h+=`&lt;div class=&quot;roul-row&quot;${isBest}&gt;&lt;span class=&quot;roul-cog&quot;&gt;Cog ${cog}${isEsc&amp;&amp;cog===bestCog?' ★':''}&lt;/span&gt;&lt;span class=&quot;roul-p&quot;&gt;${(ps*100).toFixed(1)}%&lt;/span&gt;&lt;span class=&quot;${tR.c} tier&quot; style=&quot;font-size:12px&quot;&gt;${tR.l}&lt;/span&gt;&lt;div class=&quot;ev-bar-wrap&quot;&gt;&lt;div class=&quot;ev-bar&quot; style=&quot;width:${bwR}px&quot;&gt;&lt;/div&gt;&lt;/div&gt;&lt;span class=&quot;roul-v&quot;&gt;${tv}v&lt;/span&gt;&lt;/div&gt;`;
  }
  h+=`&lt;div class=&quot;roul-note&quot;&gt;${isEsc
    ? `★ = EV-optimal cashout point under the escalating model. Conservative dist shown; high rarity may shift the optimal cog slightly. Roulette voucher rarity distribution is unverified — this is the biggest unknown in the ranking.`
    : `Conservative dist: cog 4+ for positive EV at average baseline. High rarity: may be positive earlier. Roulette voucher rarity distribution is unverified — this is the biggest unknown in the ranking.`}&lt;/div&gt;`;
  return h+'&lt;/div&gt;';
}

function id23Block(gearsVal,base,nodeWasteful,nodeOstentatious,nodeCb59){
  const n=gearsVal==='avg'?6:parseInt(gearsVal);
  let h=`&lt;div class=&quot;id23-block&quot;&gt;&lt;div class=&quot;roul-header&quot;&gt;Early end (cogs 1 to n-1): safe cashout, bypasses podium. Full completion (last cog): normal podium turnin, all procs fire. &lt;button onclick=&quot;showId23Lightbox()&quot; style=&quot;background:transparent;border:none;color:var(--blue-light);font-size:10px;cursor:pointer;padding:0;margin-left:4px&quot;&gt;how this works ↗&lt;/button&gt;&lt;/div&gt;`;
  h+=`&lt;div style=&quot;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.25);border-radius:var(--radius);padding:8px 10px;margin-bottom:8px&quot;&gt;
    &lt;div style=&quot;font-size:10px;color:var(--gold-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px&quot;&gt;Encounter Reality (~12.5% per map · safe cashout)&lt;/div&gt;
    &lt;div style=&quot;display:grid;grid-template-columns:60px 70px 1fr;gap:2px 10px;font-size:11px;margin-bottom:5px&quot;&gt;
      &lt;span style=&quot;color:var(--text-faint)&quot;&gt;Maps&lt;/span&gt;&lt;span style=&quot;color:var(--text-faint)&quot;&gt;Avg seen&lt;/span&gt;&lt;span style=&quot;color:var(--text-faint)&quot;&gt;Chance of net profit&lt;/span&gt;
      &lt;span style=&quot;color:var(--text-muted)&quot;&gt;50&lt;/span&gt;&lt;span style=&quot;color:var(--text-muted)&quot;&gt;~6&lt;/span&gt;&lt;span style=&quot;color:var(--green-recording)&quot;&gt;~100% — reliable every session&lt;/span&gt;
      &lt;span style=&quot;color:var(--text-muted)&quot;&gt;100&lt;/span&gt;&lt;span style=&quot;color:var(--text-muted)&quot;&gt;~12&lt;/span&gt;&lt;span style=&quot;color:var(--green-recording)&quot;&gt;~100%&lt;/span&gt;
      &lt;span style=&quot;color:var(--text-muted)&quot;&gt;500&lt;/span&gt;&lt;span style=&quot;color:var(--text-muted)&quot;&gt;~62&lt;/span&gt;&lt;span style=&quot;color:var(--green-recording)&quot;&gt;~100%&lt;/span&gt;
      &lt;span style=&quot;color:var(--text-muted)&quot;&gt;1000&lt;/span&gt;&lt;span style=&quot;color:var(--text-muted)&quot;&gt;~125&lt;/span&gt;&lt;span style=&quot;color:var(--green-recording)&quot;&gt;~100%&lt;/span&gt;
    &lt;/div&gt;
    &lt;div style=&quot;font-size:10px;color:var(--green-recording)&quot;&gt;Safe cashout means you never truly lose a map. Reliable value every session — unlike Roulette.&lt;/div&gt;
  &lt;/div&gt;`;
  h+=`&lt;div class=&quot;id23-row roul-row-head&quot;&gt;&lt;span class=&quot;id23-outcome&quot;&gt;Outcome&lt;/span&gt;&lt;span class=&quot;id23-prob&quot;&gt;Prob&lt;/span&gt;&lt;span class=&quot;id23-ev&quot;&gt;Tier&lt;/span&gt;&lt;/div&gt;`;
  for(let k=1;k&lt;=n;k++){
    const p=k&lt;n?Math.pow(0.90,k-1)*0.10:Math.pow(0.90,n);
    const label=k&lt;n?`End cog ${k}`:`Full run (${n})`;
    const evK=id23CogEV(k,n,base);
    const ec=evK&gt;0?'var(--green-recording)':'var(--red-loss)';
    const theorBaseK=bge()*n*MULT[n];
    let podiumBonus=0;
    if(k===n){
      if(nodeWasteful) podiumBonus+=(0.10*ege({gold:0.70,red:0.25,rainbow:0.05})+0.30*theorBaseK)/theorBaseK*base;
      if(nodeOstentatious) podiumBonus+=(0.03*ege({gold:0.70,red:0.25,rainbow:0.05})+0.10*theorBaseK)/theorBaseK*base;
      if(nodeCb59) podiumBonus+=ege(DIST)/theorBaseK*base*0.13;
    }
    const evKTotal=evK+podiumBonus;
    const evPct23=Math.max(0,evKTotal/theorBaseK*100);
    const t23=evKTotal&lt;=0?{l:'F',c:'tier-f'}:evPct23&gt;=300?{l:'S+',c:'tier-sp'}:evPct23&gt;=100?{l:'S',c:'tier-s'}:evPct23&gt;=30?{l:'A',c:'tier-a'}:evPct23&gt;=19?{l:'B',c:'tier-b'}:evPct23&gt;=5?{l:'C',c:'tier-c'}:{l:'F',c:'tier-f'};
    const bw23=Math.min(evPct23/3,100);
    const podiumNote=k===n&amp;&amp;podiumBonus&gt;0?' (+podium)':'';
    h+=`&lt;div class=&quot;id23-row&quot;&gt;&lt;span class=&quot;id23-outcome&quot;&gt;${label}${podiumNote}&lt;/span&gt;&lt;span class=&quot;id23-prob&quot;&gt;${(p*100).toFixed(1)}%&lt;/span&gt;&lt;span class=&quot;${t23.c} tier&quot; style=&quot;font-size:12px&quot;&gt;${t23.l}&lt;/span&gt;&lt;div class=&quot;ev-bar-wrap&quot;&gt;&lt;div class=&quot;ev-bar&quot; style=&quot;width:${bw23}px&quot;&gt;&lt;/div&gt;&lt;/div&gt;&lt;/div&gt;`;
  }
  return h+'&lt;/div&gt;';
}

const S12_SVCS=[
  {id:1,rarity:'blue',effect:'Immediately obtain 1 Blue Cogwheel Voucher'},
  {id:2,rarity:'blue',effect:'+1 rarity for 1 randomly selected Cogwheel'},
  {id:3,rarity:'blue',effect:'Every 4 completions → 1 extra Blue Voucher'},
  {id:4,rarity:'blue',effect:'+5s time per cogwheel start',tag:'combat',note:'Time/survival utility — no compass EV'},
  {id:5,rarity:'blue',effect:'+30% damage for 8s per cogwheel start',tag:'combat',note:'Combat utility only'},
  {id:6,rarity:'blue',effect:'Restore 30% Life/ES per second for 9s',tag:'combat',note:'Survival utility only'},
  {id:7,rarity:'blue',effect:'50% Life/ES + 7s invincibility on fatal hit (once)',tag:'combat',note:'Survival utility only'},
  {id:8,rarity:'blue',effect:'+1 rarity for 2 randomly selected Cogwheels'},
  {id:9,rarity:'blue',effect:'Immediately obtain 2–3 Cogwheel Vouchers (up to Orange)'},
  {id:10,rarity:'blue',effect:'Remove 1–2 Cogwheels, remaining all +1 rarity'},
  {id:11,rarity:'purple',effect:'6 Cogwheels. Hit B at cog 3 → jumps to SS, reaches SSS by completion',note:'Final rating SSS ×1.6 + clockwork_51 +18% additional DQ'},
  {id:13,rarity:'purple',effect:'2 Booster Drinks — touching drops extra rewards',note:'With Indulgent node: 3 drinks × 24% Runaway Dancer = 0.72 Orange vouchers avg'},
  {id:14,rarity:'purple',effect:'1 Time Extender — touching drops extra rewards',note:'With Vain node: 2 extenders × 8% Runaway Dancer = 0.16 Orange vouchers avg'},
  {id:15,rarity:'purple',effect:'30% on completion: all vouchers +1 rarity + 10s'},
  {id:16,rarity:'purple',effect:'10% per completion → 1 extra higher-rarity voucher'},
  {id:17,rarity:'purple',effect:'30% per completion → all vouchers +1 rarity'},  {id:19,rarity:'gold',effect:'15% chance → Runaway Dancer → 1 Orange Voucher'},
  {id:20,rarity:'gold',effect:'3 completions in 30s → 2 Orange Vouchers',tag:'conditional'},
  {id:21,rarity:'gold',effect:'Best Doll Employee: 20% per completion → extra voucher, mostly Red/Rainbow when it procs',note:'Community-verified: when it fires, output is dominated by Red/Rainbow — treated as S-tier on proc'},
  {id:23,rarity:'gold',effect:'40%×+1 / 20%×+2 / 5%×+3 vouchers, 10% safe early end per cog',isID23:true},
  {id:26,rarity:'gold',effect:'&lt;20s remaining → 30% extra voucher',tag:'nonviable',note:'Requires wasting time intentionally — not viable'},
  {id:27,rarity:'gold',effect:'&gt;20s remaining → 15% extra voucher',tag:'conditional',note:'Rewards fast clears naturally'},
  {id:28,name:'All Tabs on Me',rarity:'rainbow',effect:'1–2 Rainbow Cogwheels in stage. Vouchers locked until all cogwheels done.'},
  {id:29,name:&quot;Dolls' Hunting Ground&quot;,rarity:'rainbow',effect:'Time doubled, 50% per completion → extra higher-rarity voucher. Death ends run. Default S rating.'},
  {id:30,name:'Clockwork Roulette',rarity:'rainbow',effect:'10% fail per cog start (compounding). Escalating bonus vouchers if survived. Fail = entire event ends.',isRoulette:true},
  {id:31,name:&quot;Roses in the No-Man's Land&quot;,rarity:'rainbow',effect:'All monsters replaced with Low-Level Doll Employees. 7 Rainbow Cogwheels only.'},
  {id:32,name:'Bloody Mary',rarity:'rainbow',effect:'3–5 Purple+ vouchers immediately. Rating SS, 15s default. Bloody Mary chases after 3s.'},
  {id:33,name:'Clockwork Ballet Heist',rarity:'rainbow',effect:'Last cogwheel: 3 Runaway Dancers appear → 1 random voucher each (up to Red)'},
  {id:35,name:'Nut Trick',rarity:'rainbow',effect:'Complete 3 cogwheels of same rarity → all 3 become Rainbow vouchers. Player chooses which cogs.'},
];

function render(){
  try{
  const gearsVal='6'; // fixed: 6 cogs current season
  const alice=ALICE[document.getElementById('alice')?.value||'none']||ALICE['none']||{};
  const sort=document.getElementById('sort').value;
  const rdist=_rdist==='highrarity'?RDIST_HIGH:RDIST_EXP;
  // base removed — using theorBase for relative scaling
  // Doll affects compass cogwheel rate but we use calibrated base so just affects relative EV

  const aliceMult=1+alice.doubleP;



  // Wasteful baseline — flat per-run bonus, shown separately


  // ── Node EV calculations ─────────────────────────────────────────────────
  const nodeIndulgent=!!(document.getElementById('node-indulgent')&amp;&amp;document.getElementById('node-indulgent').checked);
  const nodeVain=!!(document.getElementById('node-vain')&amp;&amp;document.getElementById('node-vain').checked);
  const nodeWasteful=!!(document.getElementById('node-wasteful')&amp;&amp;document.getElementById('node-wasteful').checked);
  const nodeOstentatious=!!(document.getElementById('node-ostentatious')&amp;&amp;document.getElementById('node-ostentatious').checked);
  const nodeCb59=!!(document.getElementById('node-cb59')&amp;&amp;document.getElementById('node-cb59').checked);
  const _gl2=gearsVal==='avg'?[5,6,7]:[parseInt(gearsVal)];
  const theorBase=(1/_gl2.length)*_gl2.reduce((s,n)=&gt;s+bge()*n*MULT[n],0);
  const base=theorBase; // relative scaling — all EVs as fraction of base pool






  // ── Service table — static rankings (fe-based, ceiling-relative %) ────
  const dollVal=document.getElementById('doll')?.value||'artifact';
  const DOLL_CR={none:0.06,regular:0.19,artifact:0.45};
  const cr=DOLL_CR[dollVal]||0.45;
  const probeVal=document.getElementById('probe')?.value||'none';
  const nodeSeasonal=!!(document.getElementById('node-seasonal')?.checked);
  if(!RANKINGS){return;} // wait for JSON to load
  let svcs=S12_SVCS.map(s=&gt;{
    const entry=RANKINGS.services.find(r=&gt;r.id===s.id&amp;&amp;!r.sensitivity_only);
    return {...s,tier:entry?entry.tier:'F',pct:entry?entry.pct:0,rank:entry?entry.rank:999};
  });
  const showCombat=document.getElementById('showz')&amp;&amp;document.getElementById('showz').checked;
  if(!showCombat)svcs=svcs.filter(s=&gt;s.tier!=='F'||s.tag==='conditional'||s.tag==='builddep'||s.isRoulette||s.isID23);
  // Roulette always sorts last regardless of EV — encounter rate makes its tier misleading
  if(sort==='ev'||sort==='tier')svcs.sort((a,b)=&gt;(a.isRoulette?1:0)-(b.isRoulette?1:0)||a.rank-b.rank);
  else if(sort==='rarity')svcs.sort((a,b)=&gt;(a.isRoulette?1:0)-(b.isRoulette?1:0)||(RORD[a.rarity]||9)-(RORD[b.rarity]||9)||a.rank-b.rank);
  const maxEV=1; // unused in lookup mode

  const tagMap={combat:'&lt;span class=&quot;svc-tag tag-combat&quot;&gt;combat&lt;/span&gt;',conditional:'&lt;span class=&quot;svc-tag tag-conditional&quot;&gt;conditional&lt;/span&gt;',nonviable:'&lt;span class=&quot;svc-tag tag-nonviable&quot;&gt;not viable&lt;/span&gt;',builddep:'&lt;span class=&quot;svc-tag tag-builddep&quot;&gt;build-dep&lt;/span&gt;'};
  const tbody=document.getElementById('tbody');
  // Preserve expanded state and dropdown values before clearing
  const roulExpandedBefore=tbody.querySelector('.svc-row-roulette .svc-card-detail[style*=&quot;block&quot;]')||tbody.querySelector('.svc-row-roulette div[style*=&quot;display: block&quot;]');
  // _roulExpanded tracks whether roulette card was open
  const savedRoulFail=_roulFail;
  // _rdist is module-level, no DOM read needed
  tbody.innerHTML='';
  svcs.forEach((s,i)=&gt;{
    let t2={l:s.tier,c:'tier-'+s.tier.toLowerCase().replace('+','p')};
    const seasonBadge=nodeSeasonal&amp;&amp;s.id===11?'&lt;span style=&quot;font-size:10px;color:var(--gold-bright);margin-left:4px&quot;&gt;★ season&lt;/span&gt;':'';
    let bw=s.pct||0;
    if(s.isRoulette){
      const roulFailModel=_roulFail;
      if(roulFailModel==='escalating'){
        // Recompute Roulette's EV under escalating model, relative to theorBase
        const maxCogR=6; // fixed: 6 cogs current season
        const evEsc=roulEV(maxCogR,maxCogR===6?6:parseInt(gearsValRoul),rdist,base,'escalating');
        const theorBaseR=bge()*maxCogR*MULT[maxCogR];
        // Convert escalating EV (in theorBase units) to fe, then to %-of-ceiling
        const evFe=evEsc/theorBaseR*384.68; // 384.68fe = flat Roulette's theorBase-relative value
        const CEILING=2929;
        bw=Math.max(0,Math.round(evFe/CEILING*100*10)/10);
        t2={l:'F',c:'tier-f'};
      }
    }
    const th=s.tag?tagMap[s.tag]||'':'';
    const nameHtml=(s.name?`&lt;span class=&quot;svc-name&quot;&gt;${s.name}&lt;/span&gt;`:'')+seasonBadge;
    const effClass=s.name?'svc-effect':'svc-effect svc-effect-primary';
    const rFM=_roulFail;
    const rawEffect=s.isRoulette
      ?(rFM==='escalating'
        ?'Escalating: 10%→47% fail per cog. EV negative at max — optimal stop at cog 4. Fail = event ends.'
        :'Flat: 10% fail per cog. Escalating bonus vouchers if survived. Fail = event ends.')
      :(s.effect||s.desc||'');
    const dispEffect=rawEffect.substring(0,120)+(rawEffect.length&gt;120?'…':'');
    const eff=`&lt;div class=&quot;${effClass}&quot;&gt;${dispEffect}${th}&lt;/div&gt;`;
    const roulFailModel=_roulFail;
    const inlineWarn='';
    let extra='';
    const lbBtn=(id,label)=&gt;`&lt;button onclick=&quot;document.getElementById('${id}-lightbox').style.display='flex';document.body.style.overflow='hidden'&quot; style=&quot;background:rgba(200,164,93,0.08);border:1px solid rgba(200,164,93,0.25);border-radius:var(--radius-sm);color:var(--gold-muted);font-size:10px;font-weight:600;cursor:pointer;padding:4px 10px;margin-top:6px;display:inline-flex;align-items:center;gap:4px;transition:background .15s,border-color .15s&quot;&gt;📊 ${label} ↗&lt;/button&gt;`;
    if(s.id===10)extra=lbBtn('id10','how this is calculated');
    if(s.id===11)extra=lbBtn('id11','why SSS matters here');
    if(s.id===29)extra=lbBtn('id29','how this is calculated');
    if(s.id===32)extra=lbBtn('id32','how this is calculated');
    if(s.isRoulette)extra=`&lt;button onclick=&quot;const d=this.nextElementSibling;const open=d.style.display==='none';d.style.display=open?'block':'none';_roulExpanded=open;&quot; style=&quot;background:rgba(200,164,93,0.08);border:1px solid rgba(200,164,93,0.25);border-radius:var(--radius-sm);color:var(--gold-muted);font-size:10px;font-weight:600;cursor:pointer;padding:4px 10px;margin-top:6px&quot; title=&quot;Roulette breakdown&quot;&gt;📊&lt;/button&gt;&lt;div style=&quot;display:none&quot;&gt;&lt;div style=&quot;display:flex;gap:10px;flex-wrap:wrap;padding:8px 0 6px;border-bottom:1px solid var(--border-blue);margin-bottom:8px&quot;&gt;&lt;div style=&quot;display:flex;flex-direction:column;gap:3px&quot;&gt;&lt;label style=&quot;font-size:10px;color:var(--text-faint);letter-spacing:.03em&quot;&gt;Fail model&lt;/label&gt;&lt;select id=&quot;roulFail&quot; onchange=&quot;_roulFail=this.value;_roulExpanded=true;setTimeout(render,0)&quot; style=&quot;background:var(--bg-card);border:1px solid var(--border-blue);color:var(--text-primary);padding:6px 10px;border-radius:var(--radius);font-family:var(--font-body);font-size:11px;outline:none&quot;&gt;&lt;option value=&quot;flat&quot;&gt;Flat 10%/cog&lt;/option&gt;&lt;option value=&quot;escalating&quot;&gt;Escalating 10%→47%&lt;/option&gt;&lt;/select&gt;&lt;/div&gt;&lt;div style=&quot;display:flex;flex-direction:column;gap:3px&quot;&gt;&lt;label style=&quot;font-size:10px;color:var(--text-faint);letter-spacing:.03em&quot;&gt;Voucher dist.&lt;/label&gt;&lt;select id=&quot;rdist&quot; onchange=&quot;_rdist=this.value;_roulExpanded=true;setTimeout(render,0)&quot; style=&quot;background:var(--bg-card);border:1px solid var(--border-blue);color:var(--text-primary);padding:6px 10px;border-radius:var(--radius);font-family:var(--font-body);font-size:11px;outline:none&quot;&gt;&lt;option value=&quot;expected&quot;&gt;Expected&lt;/option&gt;&lt;option value=&quot;highrarity&quot;&gt;High rarity (observed)&lt;/option&gt;&lt;/select&gt;&lt;/div&gt;&lt;/div&gt;`+roulBlock(gearsVal,rdist,base)+`&lt;/div&gt;`;
    if(s.isID23)extra=`&lt;button onclick=&quot;this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'&quot; style=&quot;background:rgba(200,164,93,0.08);border:1px solid rgba(200,164,93,0.25);border-radius:var(--radius-sm);color:var(--gold-muted);font-size:10px;font-weight:600;cursor:pointer;padding:4px 10px;margin-top:6px&quot;&gt;📊 show outcome breakdown ▾&lt;/button&gt;&lt;div style=&quot;display:none&quot;&gt;`+id23Block(gearsVal,base,nodeWasteful,nodeOstentatious,nodeCb59)+`&lt;/div&gt;`;
    if(s.id===35){const nt=NUT[parseInt(gearsVal)]||NUT[6];extra=`&lt;div class=&quot;svc-info&quot;&gt;P(0 proc): ${(nt.p0*100).toFixed(1)}% · P(1 proc): ${(nt.p1*100).toFixed(1)}% · P(2 procs): ${(nt.p2*100).toFixed(1)}%&lt;/div&gt;`+lbBtn('id35','how this is calculated');}
    const TIER_DESCS={'S+':'Best ceiling services — these define the run.','S':'Strong picks — take if S+ isn\'t offered.','A':'Solid value — good when S/S+ aren\'t available.','B':'Interchangeable — pick whatever\'s offered.','C':'Low value — only if nothing better is available.','F':'Skip — negative or negligible EV.'};
    const TIER_COLORS={'S+':'var(--gold-primary)','S':'#a78bfa','A':'#60a5fa','B':'var(--border-strong)','C':'var(--text-faint)','F':'var(--blue-steel)'};
    const isTop=(s.rank||i+1)&lt;=2;
    const cardExtraStyle='';
    const roulNote=s.isRoulette?`&lt;span style=&quot;font-size:10px;color:var(--red-loss);margin-left:6px&quot;&gt;★ high variance&lt;/span&gt;`:'';

    const tr=document.createElement('div');
    tr.className='svc-card'+(isTop?' svc-card--top':'')+(s.isRoulette?' svc-row-roulette':'')+(s.isID23?' svc-row-id23':'');
    tr.innerHTML=`
      &lt;span class=&quot;svc-rank&quot;&gt;${s.rank||i+1}&lt;/span&gt;
      &lt;div class=&quot;svc-body&quot;&gt;
        ${nameHtml}
        ${eff}
        ${extra}
        &lt;div class=&quot;svc-meta&quot;&gt;
          &lt;span class=&quot;tag-stat ${RCLS[s.rarity]||'badge-blue'}&quot;&gt;${RLABEL[s.rarity]||s.rarity}&lt;/span&gt;
          &lt;span class=&quot;${t2.c} tier svc-tier-badge&quot;&gt;${t2.l}${s.isRoulette?'*':''}&lt;/span&gt;
          ${roulNote}
        &lt;/div&gt;
      &lt;/div&gt;
      &lt;div class=&quot;svc-ev-block&quot;&gt;
        &lt;span class=&quot;svc-ev-pct&quot;&gt;${bw.toFixed(1)}%&lt;/span&gt;
        &lt;span class=&quot;svc-ev-sub&quot;&gt;of ceiling&lt;/span&gt;
        &lt;div class=&quot;ev-bar-wrap&quot; style=&quot;width:80px;margin-top:4px&quot;&gt;&lt;div class=&quot;ev-bar&quot; style=&quot;width:${Math.min(bw*0.8,80)}px&quot;&gt;&lt;/div&gt;&lt;/div&gt;
      &lt;/div&gt;
    `;
    tbody.appendChild(tr);
    if(s.isRoulette){
      const sep=document.createElement('div');
      sep.className='tier-banner tier-banner--roulette';
      sep.innerHTML=`&lt;span class=&quot;tier-banner__label&quot; style=&quot;color:var(--red-loss)&quot;&gt;Clockwork Roulette&lt;/span&gt;&lt;span class=&quot;tier-banner__desc&quot;&gt;High variance — tap 📊 for model details&lt;/span&gt;`;
      tbody.insertBefore(sep,tr);
    } else if(i===0||svcs[i-1].tier!==s.tier||(i&gt;0&amp;&amp;svcs[i-1].isRoulette)){
      const sep=document.createElement('div');
      sep.className='tier-banner';
      sep.style.cssText=`border-top-color:${TIER_COLORS[s.tier]||'var(--border-soft)'}`;
      sep.innerHTML=`&lt;span class=&quot;tier-banner__label&quot; style=&quot;color:${TIER_COLORS[s.tier]||'var(--text-faint)'}&quot;&gt;${s.tier} Tier&lt;/span&gt;&lt;span class=&quot;tier-banner__desc&quot;&gt;${TIER_DESCS[s.tier]||''}&lt;/span&gt;`;
      tbody.insertBefore(sep,tr);
    }
  });

  const roulFailModelFoot=_roulFail;
  const roulFootEl=document.getElementById('roul-footnote');
  if(roulFootEl){
    roulFootEl.innerHTML=roulFailModelFoot==='escalating'
      ? `* Under the escalating fail model, Roulette's EV at max cogs is barely break-even — pushing to max cogs is a mistake, not just high-variance. Sorted last regardless of tier — see breakdown for the optimal cashout point.`
      : `* Roulette's per-encounter EV is mathematically correct, but at ~1 encounter per 100 maps the tier is misleading within a single season. Sorted last regardless of tier — see breakdown for the full picture.`;
  }

  // ── Reroll recommendation ──────────────────────────────────────────────

  updateVerdict();

  // Restore roulette expanded state then reset flag
  if(_roulExpanded){
    const roulCard=tbody.querySelector('.svc-row-roulette');
    if(roulCard){
      const detail=roulCard.querySelector('div[style*=&quot;display:none&quot;]');
      if(detail) detail.style.display='block';
    }
    _roulExpanded=false;
    // Restore dropdown selected values in the newly built card
    const rf=document.getElementById('roulFail');
    if(rf&amp;&amp;rf.value!==_roulFail) rf.value=_roulFail;
    const rd=document.getElementById('rdist');
    if(rd&amp;&amp;rd.value!==_rdist) rd.value=_rdist;
  }
  }catch(e){console.error('render() error:',e);}
}

['gears','doll','probe','alice','sort','showz','rdist','node-indulgent','node-vain','node-wasteful','node-cb59','node-seasonal'].forEach(id=&gt;{
  const el=document.getElementById(id);
  if(el)el.addEventListener('change',render);
});
render();
&lt;/script&gt;
&lt;script src=&quot;/shared/header.js&quot; defer&gt;&lt;/script&gt;
&lt;/body&gt;
&lt;/html&gt;
"></iframe>
