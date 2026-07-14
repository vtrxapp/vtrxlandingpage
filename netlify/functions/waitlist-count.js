// netlify/functions/waitlist-count.js
//
// Returns the REAL number of submissions to the "waitlist" Netlify Form —
// no fabricated or placeholder numbers. Requires two environment variables
// set in the Netlify dashboard (Site settings -> Environment variables):
//
//   NETLIFY_API_TOKEN  — a Personal Access Token from
//                        https://app.netlify.com/user/applications#personal-access-tokens
//   NETLIFY_SITE_ID    — this site's API ID, from
//                        Site settings -> General -> Site details -> Site ID
//
// Both stay server-side inside this function; the browser never sees them.

exports.handler = async function () {
  const TOKEN   = process.env.NETLIFY_API_TOKEN;
  const SITE_ID = process.env.NETLIFY_SITE_ID;

  if (!TOKEN || !SITE_ID) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'NETLIFY_API_TOKEN / NETLIFY_SITE_ID not configured' }),
    };
  }

  try {
    const formsRes = await fetch(`https://api.netlify.com/api/v1/sites/${SITE_ID}/forms`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    if (!formsRes.ok) throw new Error(`Netlify API (forms) returned ${formsRes.status}`);
    const forms = await formsRes.json();

    const waitlistForm = Array.isArray(forms) ? forms.find(f => f.name === 'waitlist') : null;
    if (!waitlistForm) throw new Error('No form named "waitlist" found on this site');

    // The form object itself usually carries a running submission_count —
    // fall back to counting the submissions list directly if that's ever absent.
    let count = typeof waitlistForm.submission_count === 'number' ? waitlistForm.submission_count : null;

    if (count === null) {
      const subsRes = await fetch(`https://api.netlify.com/api/v1/forms/${waitlistForm.id}/submissions`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      if (!subsRes.ok) throw new Error(`Netlify API (submissions) returned ${subsRes.status}`);
      const subs = await subsRes.json();
      count = Array.isArray(subs) ? subs.length : 0;
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        // Real signups don't need sub-minute freshness — this just keeps a
        // traffic spike from turning into a Netlify-API rate-limit problem.
        'Cache-Control': 'public, max-age=60',
      },
      body: JSON.stringify({ count }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
