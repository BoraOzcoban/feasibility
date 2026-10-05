// Returns TCMB's daily exchange-rate XML (today.xml).
//
// tcmb.gov.tr sends no CORS headers, so a browser on the deployed app cannot
// read the file itself. Local development uses the Vite proxy instead.
//
// Deploy: supabase functions deploy tcmb-rates

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const response = await fetch("https://www.tcmb.gov.tr/kurlar/today.xml", {
    headers: { Accept: "application/xml,text/xml,*/*" },
  });

  if (!response.ok) {
    return new Response(JSON.stringify({ error: `TCMB ${response.status}` }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 502,
    });
  }

  return new Response(await response.text(), {
    headers: {
      ...corsHeaders,
      // TCMB publishes once a day; a short cache keeps repeated clicks cheap.
      "Cache-Control": "public, max-age=900",
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
});
