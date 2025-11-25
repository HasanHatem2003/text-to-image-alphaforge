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
    
		const inputs = {
			prompt: prompt,
		};

		const response = await env.AI.run(
			"@cf/stabilityai/stable-diffusion-xl-base-1.0",
			inputs,
		);

		return new Response(response, {
			headers: {
				"content-type": "image/png",
			},
		});
	},
} satisfies ExportedHandler<Env>;
