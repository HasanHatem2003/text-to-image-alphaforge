// worker.js
export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Use POST', { status: 405 });
    }

    // parse JSON
    let payload;
    try {
      payload = await request.json();
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const prompt = (payload.prompt || payload.text || '').toString();
    if (!prompt) {
      return new Response(JSON.stringify({ error: 'Prompt (text or prompt) required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const steps = Math.min(Math.max(1, Number(payload.steps) || 20), 50);
    const width = Math.min(Math.max(256, Number(payload.width) || 512), 1024);
    const height = Math.min(Math.max(256, Number(payload.height) || 512), 1024);

    const model = "@cf/black-forest-labs/flux-1-schnell";

    try {
      // Run the model — aiResp may be a Response or ReadableStream
      const aiResp = await env.AI.run(model, {
        prompt,
        steps,
        width,
        height
      });

      // Normalize to a Response to access arrayBuffer()
      const resp = aiResp instanceof Response ? aiResp : new Response(aiResp);

      // If the model returned non-image (e.g., JSON error), forward it
      const contentType = resp.headers.get('Content-Type') || '';
      if (!contentType.startsWith('image/')) {
        // try to extract text/json and return to caller
        const text = await resp.text();
        return new Response(JSON.stringify({ error: 'Model returned non-image', details: text }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const ab = await resp.arrayBuffer();
      const u8 = new Uint8Array(ab);

      // base64 encode in chunks to avoid large String.fromCharCode on huge arrays
      // chunk size tuned to avoid stack/memory blowups
      const CHUNK = 0x8000; // 32k
      let binary = '';
      for (let i = 0; i < u8.length; i += CHUNK) {
        const slice = u8.subarray(i, i + CHUNK);
        binary += String.fromCharCode.apply(null, slice);
      }
      const b64 = btoa(binary);

      const json = {
        message: "Image generates successfully",
        image: b64,
        content_type: contentType
      };
      return new Response(JSON.stringify(json), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (err) {
      // catch and return stringified error
      return new Response(JSON.stringify({ error: String(err) }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
